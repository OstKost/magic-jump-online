package main

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestReplayIsCalculatedAndCanBeRetried(t *testing.T) {
	s := testServer(t)
	s.attempts["a"] = &Attempt{ID: "a", Token: "secret", Seed: 42, Count: 1, created: time.Now().Add(-4 * time.Minute)}
	for i := 0; i < 2; i++ {
		r := httptest.NewRequest("POST", "/api/attempts/a/finish", strings.NewReader(`{"token":"secret","heroes":[0],"logs":[[],[],[]]}`))
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
