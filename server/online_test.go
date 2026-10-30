package main

import (
	"encoding/json"
	"github.com/gorilla/websocket"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestOnlineMatchAwardsOnlyEligibleWinner(t *testing.T) {
	s := testServer(t)
	httpServer := httptest.NewServer(s.routes())
	defer httpServer.Close()
	post := func(path, body string) map[string]string {
		res, err := http.Post(httpServer.URL+path, "application/json", strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != 200 {
			t.Fatalf("%s: %d", path, res.StatusCode)
		}
		data := map[string]string{}
		_ = json.NewDecoder(res.Body).Decode(&data)
		return data
	}
	first := post("/api/rooms", `{}`)
	second := post("/api/rooms/"+first["code"]+"/join", `{}`)
	connect := func(auth map[string]string) *websocket.Conn {
		c, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(httpServer.URL, "http")+"/api/rooms/"+first["code"]+"/ws", nil)
		if err != nil {
			t.Fatal(err)
		}
		_ = c.WriteJSON(map[string]string{"token": auth["token"]})
		go func() {
			for {
				if _, _, err := c.ReadMessage(); err != nil {
					return
				}
			}
		}()
		return c
	}
	a, b := connect(first), connect(second)
	defer a.Close()
	defer b.Close()
	_ = a.WriteJSON(map[string]string{"type": "ready"})
	_ = b.WriteJSON(map[string]string{"type": "ready"})
	deadline := time.Now().Add(3 * time.Second)
	for {
		s.mu.Lock()
		r := s.rooms[first["code"]]
		ready := r.Members[0].Ready && r.Members[1].Ready
		s.mu.Unlock()
		if ready {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("readiness timed out")
		}
		time.Sleep(time.Millisecond)
	}
	_ = a.WriteJSON(map[string]string{"type": "start"})
	for {
		s.mu.Lock()
		r := s.rooms[first["code"]]
		playing := r.Phase == "playing"
		s.mu.Unlock()
		if playing {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("start timed out")
		}
		time.Sleep(time.Millisecond)
	}
	s.mu.Lock()
	r := s.rooms[first["code"]]
	r.Engine.Level = 4
	r.Engine.Tick = 2999
	r.Engine.Players[0].Score = 500
	r.Engine.Players[1].Score = 600
	r.Engine.Players[1].Eligible = false
	id := r.ID
	s.mu.Unlock()
	stop := make(chan struct{})
	defer close(stop)
	go s.loop(stop)
	for {
		s.mu.Lock()
		finished := r.Phase == "finished"
		s.mu.Unlock()
		if finished {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("finish timed out")
		}
		time.Sleep(time.Millisecond)
	}
	res, err := http.Post(httpServer.URL+"/api/results", "application/json", strings.NewReader(`{"id":"`+id+`","token":"`+first["token"]+`","player":0,"name":"Победитель"}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal(res.StatusCode)
	}
	var score int
	if err := s.db.QueryRow("SELECT score FROM results WHERE match_id=? AND name=?", id, "Победитель").Scan(&score); err != nil || score != 500 {
		t.Fatal(score, err)
	}
}
