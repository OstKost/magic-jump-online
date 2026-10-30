package main

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func winningLogs(seed uint32) [][]Action {
	logs := make([][]Action, 3)
	for level := 0; level < 3; level++ {
		e := newEngine(seed, level, []int{0}, nil)
		logs[level] = []Action{}
		for e.Tick < 3000 {
			nearest := 2000.
			obstacle := ""
			for _, o := range e.Items {
				if o.Kind == "obstacle" && !o.Passed && o.X >= 120 && o.X < nearest {
					nearest = o.X
					obstacle = o.Obstacle
				}
			}
			held := obstacle == "overhead" && nearest < 330
			if held != e.Players[0].Held {
				a := Action{Tick: e.Tick, Player: 0, Kind: "duck", Pressed: held}
				e.input(a)
				logs[level] = append(logs[level], a)
			}
			if obstacle == "ground" && nearest < 245 && e.Players[0].Y == 0 {
				a := Action{Tick: e.Tick, Player: 0, Kind: "jump", Pressed: true}
				e.input(a)
				logs[level] = append(logs[level], a)
			}
			e.step()
		}
	}
	return logs
}
func TestReplayIsCalculatedAndCanBeRetried(t *testing.T) {
	s := testServer(t)
	s.attempts["a"] = &Attempt{ID: "a", Token: "secret", Seed: 42, Count: 1, created: time.Now().Add(-4 * time.Minute)}
	body, _ := json.Marshal(map[string]any{"token": "secret", "heroes": []int{0}, "logs": winningLogs(42)})
	for i := 0; i < 2; i++ {
		r := httptest.NewRequest("POST", "/api/attempts/a/finish", strings.NewReader(string(body)))
		w := httptest.NewRecorder()
		s.routes().ServeHTTP(w, r)
		if w.Code != 200 || !strings.Contains(w.Body.String(), `"players"`) {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	var count int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM results").Scan(&count)
	if count != 1 {
		t.Fatal(count)
	}
}
func TestAllDeadRequiresRetryButOneLivingPlayerKeepsGhosts(t *testing.T) {
	e := newEngine(42, 0, []int{0, 1}, nil)
	e.Players[0].Lives = 0
	if e.allDead() {
		t.Fatal("a ghost must keep playing with a living partner")
	}
	e.Players[1].Lives = 0
	if !e.allDead() {
		t.Fatal("all dead must end the attempt")
	}
}

func TestReplayRejectsJourneyWhereEveryoneDied(t *testing.T) {
	s := testServer(t)
	s.attempts["a"] = &Attempt{ID: "a", Token: "secret", Seed: 42, Count: 1, created: time.Now().Add(-4 * time.Minute)}
	r := httptest.NewRequest("POST", "/api/attempts/a/finish", strings.NewReader(`{"token":"secret","heroes":[0],"logs":[[],[],[]]}`))
	w := httptest.NewRecorder()
	s.routes().ServeHTTP(w, r)
	if w.Code != 400 {
		t.Fatal(w.Code, w.Body.String())
	}
}
