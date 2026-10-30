package main

import (
	"encoding/json"
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
			t.Fatalf("route %d differs", i)
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
func TestRankingOnlyWinnersAndIdempotency(t *testing.T) {
	s := testServer(t)
	now := time.Now()
	if err := s.record("match", []Body{{Score: 100, Eligible: true}, {Score: 50, Eligible: true}}, now); err != nil {
		t.Fatal(err)
	}
	_ = s.record("match", []Body{{Score: 100, Eligible: true}}, now)
	var n int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM results").Scan(&n)
	if n != 1 {
		t.Fatal(n)
	}
	s.attempts["match"] = &Attempt{Token: "secret", Count: 2, done: true}
	request := func(body string) int {
		r := httptest.NewRequest("POST", "/api/results", strings.NewReader(body))
		w := httptest.NewRecorder()
		s.routes().ServeHTTP(w, r)
		return w.Code
	}
	if request(`{"id":"match","token":"bad","player":0,"name":"A"}`) != 403 {
		t.Fatal("bad token accepted")
	}
	if request(`{"id":"match","token":"secret","player":1,"name":"A"}`) != 409 {
		t.Fatal("loser accepted")
	}
	if request(`{"id":"match","token":"secret","player":0,"name":"<b>A</b>"}`) != 200 {
		t.Fatal("winner rejected")
	}
	if request(`{"id":"match","token":"secret","player":0,"name":"B"}`) != 409 {
		t.Fatal("duplicate accepted")
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
