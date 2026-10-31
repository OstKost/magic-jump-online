package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestUnreadSocketDoesNotStallOtherRooms(t *testing.T) {
	s := testServer(t)
	httpServer := httptest.NewServer(s.routes())
	defer httpServer.Close()
	response, err := http.Post(httpServer.URL+"/api/rooms", "application/json", strings.NewReader(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	var session map[string]string
	_ = json.NewDecoder(response.Body).Decode(&session)
	response.Body.Close()
	c, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(httpServer.URL, "http")+"/api/rooms/"+session["code"]+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	_ = c.WriteJSON(map[string]string{"token": session["token"]})
	deadline := time.Now().Add(time.Second)
	for {
		s.mu.Lock()
		connected := s.rooms[session["code"]].Members[0].Connected
		s.mu.Unlock()
		if connected {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("not connected")
		}
		time.Sleep(time.Millisecond)
	}
	s.mu.Lock()
	slow := s.rooms[session["code"]]
	slow.Engine = combatEngine()
	// Large legal snapshot fills the unread connection. No socket read follows auth.
	for i := 0; i < 1000; i++ {
		slow.Engine.Items = append(slow.Engine.Items, Object{Event: Event{Kind: "bonus"}, X: 10000})
	}
	for i := 0; i < 4; i++ {
		s.rooms[string(rune('a'+i))] = &Room{ID: string(rune('a' + i)), Phase: "playing", Difficulty: "easy", created: time.Now(), Members: []*Member{{Connected: true}, {Connected: true}}, Engine: combatEngine()}
	}
	s.mu.Unlock()
	stop := make(chan struct{})
	defer close(stop)
	go s.loop(stop)
	var latencies, intervals []time.Duration
	lastTick := 0
	var lastTickAt time.Time
	for i := 0; i < 40; i++ {
		start := time.Now()
		s.mu.Lock()
		s.rooms["a"].Engine.input(Action{Player: 0, Kind: "jump"})
		tick := s.rooms["a"].Engine.Tick
		s.mu.Unlock()
		latencies = append(latencies, time.Since(start))
		if tick != lastTick {
			now := time.Now()
			if !lastTickAt.IsZero() {
				intervals = append(intervals, now.Sub(lastTickAt))
			}
			lastTick = tick
			lastTickAt = now
		}
		time.Sleep(10 * time.Millisecond)
	}
	s.mu.Lock()
	ticks := s.rooms["a"].Engine.Tick
	queued := len(slow.Members[0].out)
	s.mu.Unlock()
	if ticks < 15 || queued > 2 {
		t.Fatalf("healthy ticks=%d queued=%d", ticks, queued)
	}
	sort.Slice(latencies, func(i, j int) bool { return latencies[i] < latencies[j] })
	sort.Slice(intervals, func(i, j int) bool { return intervals[i] < intervals[j] })
	t.Logf("sampled healthy tick cadence p95=%s p99=%s", intervals[(len(intervals)-1)*95/100], intervals[len(intervals)-1])
	t.Logf("5 rooms / one unread socket: healthy ticks=%d; input lock p95=%s p99=%s; queued=%d", ticks, latencies[37], latencies[39], queued)
	if latencies[37] > 100*time.Millisecond {
		t.Fatal("slow socket stalled input")
	}
}
