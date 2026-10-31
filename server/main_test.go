package main

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func testServer(t *testing.T) *Server {
	t.Helper()
	db, err := openDB(filepath.Join(t.TempDir(), "test.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return &Server{db: db, rooms: map[string]*Room{}, attempts: map[string]*Attempt{}, limits: map[string][]time.Time{}}
}
func TestEngineGhostAndBonuses(t *testing.T) {
	e := newEngine(42, 0, []int{0}, nil)
	for e.Tick < 3000 {
		e.step()
	}
	if e.Players[0].Lives != 0 {
		t.Fatal("runner must become a ghost")
	}
	e.Players[0].Held = true
	e.Items = []Object{{Event: Event{Kind: "bonus", Obstacle: "overhead"}, X: 165, Player: 0}}
	before := e.Players[0].Score
	e.step()
	if e.Players[0].Score != before+20 {
		t.Fatal("duck ghost bonus must award 20")
	}
	e.Items = []Object{{Event: Event{Kind: "obstacle", Obstacle: "ground"}, X: 165, Player: 0}}
	e.step()
	if !e.Items[0].Passed || e.Players[0].Score != before+20 {
		t.Fatal("ghost collision must not earn points")
	}
}
func TestWeekBoundary(t *testing.T) {
	before := time.Date(2026, 11, 1, 20, 59, 59, 0, time.UTC)
	after := before.Add(time.Second)
	if week(before) != "2026-10-26" || week(after) != "2026-11-02" {
		t.Fatal(week(before), week(after))
	}
}
func TestGoldenRules(t *testing.T) {
	data, err := os.ReadFile("testdata/rules.json")
	if err != nil {
		t.Fatal(err)
	}
	var f struct {
		Seed    uint32    `json:"seed"`
		Routes  [][]Event `json:"routes"`
		Logs    []Action  `json:"logs"`
		Players []Body    `json:"players"`
	}
	if err = json.Unmarshal(data, &f); err != nil {
		t.Fatal(err)
	}
	for i, want := range f.Routes {
		got, _ := json.Marshal(route(f.Seed, i))
		expected, _ := json.Marshal(want)
		if string(got) != string(expected) {
			t.Fatalf("route %d differs:\nGOT:\n%s\nWANT:\n%s", i, string(got), string(expected))
		}
	}
	e := newEngine(f.Seed, 0, []int{0, 1}, nil)
	next := 0
	for e.Tick < 3000 {
		for next < len(f.Logs) && f.Logs[next].Tick == e.Tick {
			e.input(f.Logs[next])
			next++
		}
		e.step()
	}
	for i, p := range e.Players {
		if p.Score != f.Players[i].Score || p.Lives != f.Players[i].Lives {
			t.Fatalf("player %d got %+v want %+v", i, p, f.Players[i])
		}
	}
}
func TestRankingAllPlayersAndIdempotency(t *testing.T) {
	s := testServer(t)
	now := time.Now()
	if err := s.record("match", []Body{{Score: 100, Eligible: true}, {Score: 50, Eligible: true}}, now, "medium"); err != nil {
		t.Fatal(err)
	}
	_ = s.record("match", []Body{{Score: 100, Eligible: true}}, now, "medium")
	var n int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM results").Scan(&n)
	if n != 2 {
		t.Fatalf("expected 2 players recorded, got %d", n)
	}
	s.attempts["match"] = &Attempt{Token: "secret", Count: 2, done: true}
	request := func(body string) int {
		path := "/api/results"
		if strings.Contains(body, "offline-123") {
			path += "/offline"
		}
		r := httptest.NewRequest("POST", path, strings.NewReader(body))
		w := httptest.NewRecorder()
		s.routes().ServeHTTP(w, r)
		return w.Code
	}
	if request(`{"id":"match","token":"bad","player":0,"name":"A"}`) != 403 {
		t.Fatal("bad token accepted")
	}
	if request(`{"id":"match","token":"secret","player":1,"name":"Second"}`) != 200 {
		t.Fatal("non-winner rejected")
	}
	if request(`{"id":"match","token":"secret","player":0,"name":"<b>A</b>"}`) != 200 {
		t.Fatal("winner rejected")
	}
	if request(`{"id":"match","token":"secret","player":0,"name":"B"}`) != 409 {
		t.Fatal("duplicate accepted")
	}
	// Test offline result submission
	if request(`{"id":"offline-123","player":0,"name":"OfflineHero","score":350,"difficulty":"hard"}`) != 200 {
		t.Fatal("offline submission rejected")
	}
	// Test idempotent retry of offline result
	if request(`{"id":"offline-123","player":0,"name":"OfflineHero","score":350,"difficulty":"hard"}`) != 200 {
		t.Fatal("offline duplicate rejected")
	}
}
func TestRoomLimitAndSocketAuth(t *testing.T) {
	s := testServer(t)
	server := httptest.NewServer(s.routes())
	defer server.Close()
	post := func(path string) map[string]string {
		res, err := http.Post(server.URL+path, "application/json", strings.NewReader(`{}`))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		var data map[string]string
		_ = json.NewDecoder(res.Body).Decode(&data)
		return data
	}
	created := post("/api/rooms")
	code := created["code"]
	if len(code) != 4 {
		t.Fatal(created)
	}
	for i := 0; i < 3; i++ {
		post("/api/rooms/" + code + "/join")
	}
	res, err := http.Post(server.URL+"/api/rooms/"+code+"/join", "application/json", strings.NewReader(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 409 {
		t.Fatal("fifth member accepted")
	}
	c, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http")+"/api/rooms/"+code+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	_ = c.WriteJSON(map[string]string{"token": created["token"]})
	var room Room
	if err = c.ReadJSON(&room); err != nil || len(room.Members) != 4 {
		t.Fatal(err)
	}
	if strings.Contains(string(mustJSON(room)), created["token"]) {
		t.Fatal("credential exposed")
	}
	// A hero already selected by another participant must remain selectable online.
	_ = c.WriteJSON(map[string]any{"type": "ready"})
	if err = c.ReadJSON(&room); err != nil || !room.Members[0].Ready {
		t.Fatal("ready failed", err)
	}
	_ = c.WriteJSON(map[string]any{"type": "hero", "hero": 3})
	if err = c.ReadJSON(&room); err != nil {
		t.Fatal(err)
	}
	if room.Members[0].Hero != 3 || room.Members[3].Hero != 3 || room.Members[0].Ready {
		t.Fatal("duplicate hero must be accepted and changing hero must reset ready")
	}
	_ = c.WriteJSON(map[string]any{"type": "hero", "hero": 6})
	if err = c.ReadJSON(&room); err != nil || room.Members[0].Hero != 6 {
		t.Fatal("Sensei must be selectable immediately", err)
	}
	_ = c.WriteJSON(map[string]any{"type": "hero", "hero": 7})
	if err = c.ReadJSON(&room); err != nil || room.Members[0].Hero != 6 {
		t.Fatal("invalid hero must be rejected", err)
	}
}
func mustJSON(v any) []byte { b, _ := json.Marshal(v); return b }
func TestRejectIncompleteReplay(t *testing.T) {
	s := testServer(t)
	a := &Attempt{ID: "a", Token: "secret", Count: 1, Seed: 1, created: time.Now()}
	s.attempts[a.ID] = a
	r := httptest.NewRequest("POST", "/api/attempts/a/finish", strings.NewReader(`{"token":"secret","heroes":[0],"logs":[[],[],[]]}`))
	w := httptest.NewRecorder()
	s.routes().ServeHTTP(w, r)
	if w.Code != 400 {
		t.Fatal(w.Code)
	}
}

func TestRankingByDifficulty(t *testing.T) {
	s := testServer(t)
	now := time.Now()
	_ = s.record("match-easy", []Body{{Score: 120, Eligible: true}}, now, "easy")
	_ = s.record("match-hard", []Body{{Score: 350, Eligible: true}}, now, "hard")
	_, _ = s.db.Exec("UPDATE results SET name='EasyHero' WHERE match_id='match-easy'")
	_, _ = s.db.Exec("UPDATE results SET name='HardHero' WHERE match_id='match-hard'")

	reqEasy := httptest.NewRequest("GET", "/api/ranking?difficulty=easy", nil)
	wEasy := httptest.NewRecorder()
	s.routes().ServeHTTP(wEasy, reqEasy)
	if !strings.Contains(wEasy.Body.String(), "EasyHero") || strings.Contains(wEasy.Body.String(), "HardHero") {
		t.Fatalf("easy ranking mismatch: %s", wEasy.Body.String())
	}

	reqHard := httptest.NewRequest("GET", "/api/ranking?difficulty=hard", nil)
	wHard := httptest.NewRecorder()
	s.routes().ServeHTTP(wHard, reqHard)
	if !strings.Contains(wHard.Body.String(), "HardHero") || strings.Contains(wHard.Body.String(), "EasyHero") {
		t.Fatalf("hard ranking mismatch: %s", wHard.Body.String())
	}
}

func TestOnlineHostDifficultySelection(t *testing.T) {
	s := testServer(t)
	server := httptest.NewServer(s.routes())
	defer server.Close()

	// 1. Create room (host)
	res, err := http.Post(server.URL+"/api/rooms", "application/json", strings.NewReader(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var hostData map[string]string
	_ = json.NewDecoder(res.Body).Decode(&hostData)
	code := hostData["code"]

	// Connect host WS
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/rooms/" + code + "/ws"
	hostWS, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer hostWS.Close()
	_ = hostWS.WriteJSON(map[string]string{"token": hostData["token"]})
	var room Room
	if err := hostWS.ReadJSON(&room); err != nil {
		t.Fatal(err)
	}
	if room.Difficulty != "medium" {
		t.Fatalf("expected default medium difficulty, got %q", room.Difficulty)
	}

	// 2. Join second player (guest)
	joinRes, err := http.Post(server.URL+"/api/rooms/"+code+"/join", "application/json", strings.NewReader(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	defer joinRes.Body.Close()
	var guestData map[string]string
	_ = json.NewDecoder(joinRes.Body).Decode(&guestData)

	// Consume host update from join
	_ = hostWS.ReadJSON(&room)

	// Connect guest WS
	guestWS, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer guestWS.Close()
	_ = guestWS.WriteJSON(map[string]string{"token": guestData["token"]})
	var guestRoom Room
	_ = guestWS.ReadJSON(&guestRoom)
	_ = hostWS.ReadJSON(&room)

	// 3. Guest tries to change difficulty to "hard" - must be ignored!
	_ = guestWS.WriteJSON(map[string]any{"type": "difficulty", "difficulty": "hard"})
	_ = guestWS.ReadJSON(&guestRoom)
	_ = hostWS.ReadJSON(&room)
	if guestRoom.Difficulty != "medium" {
		t.Fatalf("guest must NOT be able to change difficulty, got %q", guestRoom.Difficulty)
	}

	// 4. Host changes difficulty to "easy" - must be accepted!
	_ = hostWS.WriteJSON(map[string]any{"type": "difficulty", "difficulty": "easy"})
	if err := hostWS.ReadJSON(&room); err != nil {
		t.Fatal(err)
	}
	if room.Difficulty != "easy" {
		t.Fatalf("host changing difficulty to easy failed, got %q", room.Difficulty)
	}
	_ = guestWS.ReadJSON(&guestRoom)
	if guestRoom.Difficulty != "easy" {
		t.Fatalf("guest should receive updated difficulty easy, got %q", guestRoom.Difficulty)
	}

	// 5. Host and guest ready, and host starts
	_ = guestWS.WriteJSON(map[string]any{"type": "ready"})
	_ = guestWS.ReadJSON(&guestRoom)
	_ = hostWS.ReadJSON(&room)

	_ = hostWS.WriteJSON(map[string]any{"type": "ready"})
	_ = hostWS.ReadJSON(&room)
	_ = guestWS.ReadJSON(&guestRoom)

	_ = hostWS.WriteJSON(map[string]any{"type": "start"})
	_ = hostWS.ReadJSON(&room)
	if room.Phase != "playing" || room.Engine == nil {
		t.Fatalf("expected playing phase with engine, got phase %q", room.Phase)
	}
	if room.Engine.Difficulty != "easy" {
		t.Fatalf("expected engine difficulty easy, got %q", room.Engine.Difficulty)
	}
	if room.Engine.Players[0].Lives != 4 {
		t.Fatalf("expected 4 starting lives for easy online engine, got %d", room.Engine.Players[0].Lives)
	}
}

func TestRankingTop20Limit(t *testing.T) {
	s := testServer(t)
	now := time.Now()
	for i := 1; i <= 25; i++ {
		_, err := s.db.Exec("INSERT INTO results(match_id, player, score, week, finished, name, difficulty) VALUES(?, 0, ?, ?, ?, ?, 'medium')",
			fmt.Sprintf("m-%d", i), i*10, week(now), now.Unix(), fmt.Sprintf("Player%d", i))
		if err != nil {
			t.Fatal(err)
		}
	}
	r := httptest.NewRequest("GET", "/api/ranking?difficulty=medium", nil)
	w := httptest.NewRecorder()
	s.routes().ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var data struct {
		Entries []struct {
			Name  string `json:"name"`
			Score int    `json:"score"`
		} `json:"entries"`
	}
	if err := json.NewDecoder(w.Body).Decode(&data); err != nil {
		t.Fatal(err)
	}
	if len(data.Entries) != 20 {
		t.Fatalf("expected exactly 20 entries, got %d", len(data.Entries))
	}
	if data.Entries[0].Score != 250 || data.Entries[19].Score != 60 {
		t.Fatalf("expected highest score 250, 20th score 60; got %d and %d", data.Entries[0].Score, data.Entries[19].Score)
	}
}

func TestOnlineMatchRecordsAllPlayersOnDefeat(t *testing.T) {
	s := testServer(t)
	now := time.Now()
	players := []Body{
		{Score: 150, Lives: 0, Eligible: true},
		{Score: 220, Lives: 0, Eligible: true},
	}
	room := &Room{
		ID:         "defeat-room",
		Code:       "9999",
		Difficulty: "medium",
		Members: []*Member{
			{ID: "m1", token: "tok1"},
			{ID: "m2", token: "tok2"},
		},
		Engine: &Engine{
			Level:   1,
			Players: players,
		},
		Phase:   "playing",
		created: now,
	}
	s.rooms["9999"] = room

	stop := make(chan struct{})
	defer close(stop)
	go s.loop(stop)

	deadline := time.Now().Add(2 * time.Second)
	for {
		s.mu.Lock()
		phase := room.Phase
		s.mu.Unlock()
		if phase == "finished" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("room did not transition to finished on defeat, phase=%q", phase)
		}
		time.Sleep(10 * time.Millisecond)
	}

	var count int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM results WHERE match_id='defeat-room'").Scan(&count)
	if count != 0 {
		t.Fatalf("defeats must remain device-local, got %d shared rows", count)
	}
}
