package main

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func resultRequest(s *Server, path, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	s.routes().ServeHTTP(w, httptest.NewRequest("POST", path, strings.NewReader(body)))
	return w
}
func TestProofAndOfflineContracts(t *testing.T) {
	s := testServer(t)
	body := `{"id":"unknown","player":0,"name":"Hero","score":499999,"difficulty":"easy"}`
	if w := resultRequest(s, "/api/results", body); w.Code != 403 {
		t.Fatal(w.Code, w.Body.String())
	}
	for i := 0; i < 2; i++ {
		if w := resultRequest(s, "/api/results/offline", body); w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	if w := resultRequest(s, "/api/results/offline", strings.Replace(body, "499999", "123", 1)); w.Code != 409 {
		t.Fatal(w.Code)
	}
	var proof string
	if err := s.db.QueryRow("SELECT provenance FROM results WHERE match_id='offline:unknown'").Scan(&proof); err != nil || proof != "offline" {
		t.Fatal(proof, err)
	}
	s.attempts["pending"] = &Attempt{Token: "proof", Count: 1}
	if w := resultRequest(s, "/api/results", `{"id":"pending","token":"proof","player":0,"name":"Hero"}`); w.Code != 403 {
		t.Fatal(w.Code)
	}
	s.attempts["valid"] = &Attempt{Token: "proof", Count: 1, done: true, created: time.Now()}
	if w := resultRequest(s, "/api/results", `{"id":"valid","token":"proof","player":0,"name":"Hero"}`); w.Code != 409 || !strings.Contains(w.Body.String(), "result_pending") {
		t.Fatal(w.Code, w.Body.String())
	}
	if err := s.record("valid", []Body{{Eligible: true, Score: 5}}, time.Now(), "easy"); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if w := resultRequest(s, "/api/results", `{"id":"valid","token":"proof","player":0,"name":"Hero"}`); w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	if w := resultRequest(s, "/api/results", `{"id":"valid","token":"proof","player":0,"name":"Other"}`); w.Code != 409 || !strings.Contains(w.Body.String(), "name_conflict") {
		t.Fatal(w.Code, w.Body.String())
	}
}
func TestPersistenceFailureAndManualRetry(t *testing.T) {
	s := testServer(t)
	_, err := s.db.Exec(`CREATE TRIGGER fail_results BEFORE INSERT ON results BEGIN SELECT RAISE(FAIL,'fault injection'); END`)
	if err != nil {
		t.Fatal(err)
	}
	room := &Room{ID: "fault", Phase: "finished", Difficulty: "easy", finished: time.Now(), Engine: newEngineWithDifficulty(42, 2, []int{0}, nil, "easy")}
	wait := func(want string) {
		t.Helper()
		deadline := time.Now().Add(time.Second)
		for time.Now().Before(deadline) {
			s.mu.Lock()
			state := room.Persistence
			s.mu.Unlock()
			if state == want {
				return
			}
			time.Sleep(time.Millisecond)
		}
		t.Fatal("missing persistence state", want)
	}
	s.mu.Lock()
	s.persistRoom(room)
	s.mu.Unlock()
	wait("error")
	if _, err := s.db.Exec("DROP TRIGGER fail_results"); err != nil {
		t.Fatal(err)
	}
	s.mu.Lock()
	s.persistRoom(room)
	s.mu.Unlock()
	wait("saved")
	var count int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM results WHERE match_id='fault'").Scan(&count)
	if count != 1 {
		t.Fatal(count)
	}
}
func TestReplayRejectsOutOfBoundsAction(t *testing.T) {
	s := testServer(t)
	s.attempts["bounds"] = &Attempt{ID: "bounds", Token: "proof", Count: 1, Difficulty: "easy", created: time.Now().Add(-time.Minute)}
	r := resultRequest(s, "/api/attempts/bounds/finish", `{"token":"proof","heroes":[0],"logs":[[{"tick":1000,"player":0,"kind":"jump","pressed":true}],[],[]]}`)
	if r.Code != 400 || !strings.Contains(r.Body.String(), "журнал") {
		t.Fatal(r.Code, r.Body.String())
	}
}

func TestReconnectStatusIsAuthoritative(t *testing.T) {
	s := testServer(t)
	gone := time.Now().Add(-5 * time.Second)
	s.rooms["1234"] = &Room{ID: "room", Phase: "playing", Members: []*Member{{ID: "m", token: "proof", gone: gone}}, Engine: newEngineWithDifficulty(42, 0, []int{0}, nil, "easy")}
	w := resultRequest(s, "/api/rooms/1234/status", `{"token":"proof"}`)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "reconnectDeadline") || !strings.Contains(w.Body.String(), "serverTime") {
		t.Fatal(w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "proof") {
		t.Fatal("credentials exposed")
	}
	if w := resultRequest(s, "/api/rooms/1234/status", `{"token":"wrong"}`); w.Code != 404 {
		t.Fatal(w.Code)
	}
}

func TestLegacyRowsWithoutProofAreOffline(t *testing.T) {
	s := testServer(t)
	_, err := s.db.Exec("INSERT INTO results(match_id,player,score,week,finished,name,difficulty) VALUES('legacy',0,9,?,?,'Legacy','easy')", week(time.Now()), time.Now().Unix())
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	s.routes().ServeHTTP(w, httptest.NewRequest("GET", "/api/ranking?difficulty=easy", nil))
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"provenance":"offline"`) {
		t.Fatal(w.Code, w.Body.String())
	}
}
