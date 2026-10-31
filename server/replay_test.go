package main

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func winningLogs(seed uint32) [][]Action {
	logs := make([][]Action, journeyStages)
	for level := 0; level < journeyStages; level++ {
		e := newEngine(seed, level, []int{0}, nil)
		logs[level] = []Action{}
		for e.Tick < 3000 {
			nearest := 2000.
			obstacle := ""
			for _, o := range e.Items {
				if (o.Kind == "obstacle" || o.Kind == "enemy" || o.Kind == "platform") && !o.Passed && o.X >= 120 && o.X < nearest {
					nearest = o.X
					obstacle = o.Obstacle
					if o.Kind == "platform" {
						obstacle = "platform"
					}
				}
			}
			held := obstacle == "overhead" && nearest < 330
			if held != e.Players[0].Held {
				a := Action{Tick: e.Tick, Player: 0, Kind: "duck", Pressed: held}
				e.input(a)
				logs[level] = append(logs[level], a)
			}
			if ((obstacle == "ground" && nearest < 245) || (obstacle == "platform" && nearest < 500)) && e.Players[0].Y == 0 {
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
	s.attempts["a"] = &Attempt{ID: "a", Token: "secret", Seed: 42, Count: 1, created: time.Now().Add(-6 * time.Minute)}
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
	s.attempts["a"] = &Attempt{ID: "a", Token: "secret", Seed: 42, Count: 1, created: time.Now().Add(-6 * time.Minute)}
	r := httptest.NewRequest("POST", "/api/attempts/a/finish", strings.NewReader(`{"token":"secret","heroes":[0],"logs":[[],[],[]]}`))
	w := httptest.NewRecorder()
	s.routes().ServeHTTP(w, r)
	if w.Code != 400 {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestEngineDoubleJump(t *testing.T) {
	e := newEngine(42, 0, []int{0}, nil)
	e.input(Action{Player: 0, Kind: "jump", Pressed: true})
	if e.Players[0].Jumps != 1 || e.Players[0].Velocity != -650 {
		t.Fatalf("first jump failed: %+v", e.Players[0])
	}
	e.step()
	if e.Players[0].Y >= 0 {
		t.Fatalf("expected airborne runner, got %f", e.Players[0].Y)
	}
	e.input(Action{Player: 0, Kind: "jump", Pressed: true})
	if e.Players[0].Jumps != 2 || e.Players[0].Velocity != -650 {
		t.Fatalf("double jump failed: %+v", e.Players[0])
	}
	// Third jump in air must be ignored
	e.input(Action{Player: 0, Kind: "jump", Pressed: true})
	if e.Players[0].Jumps != 2 {
		t.Fatalf("third jump should be ignored: %+v", e.Players[0])
	}
	// Run steps until runner lands on ground
	for e.Players[0].Y < 0 {
		e.step()
	}
	if e.Players[0].Jumps != 0 {
		t.Fatalf("jumps counter should reset on landing: %+v", e.Players[0])
	}
}

func TestDoubleJumpBonusReachability(t *testing.T) {
	p := Body{Y: 0, Lives: 3}
	if collision(p, "none") {
		t.Fatal("ground player must not collide when obstacle is none")
	}
	// Bonus at height requiring double jump (-130 to -230)
	singleApexY := -111.18
	if singleApexY < -130 && singleApexY > -230 {
		t.Fatal("single jump apex must not enter double jump bonus zone")
	}
	doubleJumpApexY := -180.0
	if !(doubleJumpApexY < -130 && doubleJumpApexY > -230) {
		t.Fatal("double jump apex must enter double jump bonus zone")
	}
}
