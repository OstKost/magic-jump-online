package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"reflect"
	"testing"
)

func TestParityMatrix(t *testing.T) {
	data, err := os.ReadFile("testdata/parity.json")
	if err != nil {
		t.Fatal(err)
	}
	type state struct {
		Y, Velocity                                                                         float64
		Lives, Score, RoundScore, Jumps, ReadyAt, ReadyDashAt, DashUntil, Immune, FallUntil int
		Grounded, Duck, Held                                                                bool
	}
	var cases []struct {
		Order      []int
		Seed       uint32
		World      int
		Difficulty string
		Ticks      int
		Logs       []Action
		Routes     [][]Event
		Snapshots  []struct {
			Tick    int
			Players []state
		}
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		t.Run(fmt.Sprintf("%d/world%d/%s", c.Seed, c.World, c.Difficulty), func(t *testing.T) {
			e := newEngineWithDifficulty(c.Seed, 0, []int{0, 1}, nil, c.Difficulty)
			e.World = c.World
			if !reflect.DeepEqual(c.Order, worldOrder(c.Seed)) {
				t.Fatal("journey order drift")
			}
			for i, route := range c.Routes {
				if !reflect.DeepEqual(e.plans[i], route) {
					t.Fatalf("route %d drift", i)
				}
			}
			cursor, snapshot := 0, 0
			for e.Tick < c.Ticks {
				for cursor < len(c.Logs) && c.Logs[cursor].Tick == e.Tick {
					e.input(c.Logs[cursor])
					cursor++
				}
				e.step()
				if snapshot < len(c.Snapshots) && c.Snapshots[snapshot].Tick == e.Tick {
					for i, want := range c.Snapshots[snapshot].Players {
						p := e.Players[i]
						got := state{p.Y, p.Velocity, p.Lives, p.Score, p.RoundScore, p.Jumps, p.ReadyAt, p.ReadyDashAt, p.DashUntil, p.Immune, p.FallUntil, p.Grounded, p.Duck, p.Held}
						if math.Abs(got.Y-want.Y) > 1e-8 || math.Abs(got.Velocity-want.Velocity) > 1e-8 {
							t.Fatalf("tick %d player %d motion got %+v want %+v", e.Tick, i, got, want)
						}
						got.Y = want.Y
						got.Velocity = want.Velocity
						if got != want {
							t.Fatalf("tick %d player %d got %+v want %+v", e.Tick, i, got, want)
						}
					}
					snapshot++
				}
			}
		})
	}
}
