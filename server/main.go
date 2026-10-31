package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/websocket"
	"log"
	"math/big"
	_ "modernc.org/sqlite"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	_ "time/tzdata"
	"unicode"
)

type Member struct {
	ID                string `json:"id"`
	Hero              int    `json:"hero"`
	Ready             bool   `json:"ready"`
	Connected         bool   `json:"connected"`
	token             string
	conn              *websocket.Conn
	ReconnectDeadline int64 `json:"reconnectDeadline,omitempty"`
	out               chan []byte
	gone              time.Time
	lastInput         time.Time
}
type Room struct {
	Code             string    `json:"code"`
	Host             string    `json:"host"`
	Phase            string    `json:"phase"`
	Difficulty       string    `json:"difficulty"`
	Members          []*Member `json:"members"`
	Engine           *Engine   `json:"engine,omitempty"`
	ID               string    `json:"id"`
	Seed             uint32    `json:"seed"`
	ServerTime       int64     `json:"serverTime"`
	Persistence      string    `json:"persistence"`
	PersistenceError string    `json:"persistenceError,omitempty"`
	persistAttempts  int
	persistNext      time.Time
	persistBusy      bool
	created          time.Time
	finished         time.Time
}
type Attempt struct {
	ID         string `json:"id"`
	Token      string `json:"token"`
	Seed       uint32 `json:"seed"`
	Count      int    `json:"count"`
	Difficulty string `json:"difficulty,omitempty"`
	created    time.Time
	done       bool
	players    []Body
}
type Server struct {
	mu       sync.Mutex
	rooms    map[string]*Room
	attempts map[string]*Attempt
	db       *sql.DB
	origin   string
	limits   map[string][]time.Time
}

func token() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func seed() uint32 { n, _ := rand.Int(rand.Reader, big.NewInt(1<<32)); return uint32(n.Uint64()) }
func week(t time.Time) string {
	loc, _ := time.LoadLocation("Europe/Moscow")
	t = t.In(loc)
	d := (int(t.Weekday()) + 6) % 7
	return t.AddDate(0, 0, -d).Format("2006-01-02")
}
func send(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(v)
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		apiError(w, 400, "invalid_request", "Некорректный запрос", false)
		return false
	}
	return true
}
func (s *Server) allowed(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin != "" && origin != s.origin {
		u, err := url.Parse(origin)
		if err != nil || u.Host != r.Host {
			http.Error(w, "Недопустимый источник", 403)
			return false
		}
	}
	if r.Method == "GET" {
		return true
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	if ip := net.ParseIP(r.Header.Get("X-Real-IP")); ip != nil {
		host = ip.String()
	}
	now := time.Now()
	s.mu.Lock()
	var recent []time.Time
	for _, t := range s.limits[host] {
		if now.Sub(t) < time.Minute {
			recent = append(recent, t)
		}
	}
	if len(recent) >= 120 {
		s.mu.Unlock()
		http.Error(w, "Слишком много запросов", 429)
		return false
	}
	s.limits[host] = append(recent, now)
	s.mu.Unlock()
	return true
}
func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if err := s.db.Ping(); err != nil {
			http.Error(w, "database unavailable", 503)
			return
		}
		send(w, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /api/rooms", s.createRoom)
	mux.HandleFunc("POST /api/rooms/{code}/join", s.joinRoom)
	mux.HandleFunc("GET /api/rooms/{code}/ws", s.socket)
	mux.HandleFunc("POST /api/rooms/{code}/status", s.roomStatus)
	mux.HandleFunc("POST /api/attempts", s.createAttempt)
	mux.HandleFunc("POST /api/attempts/{id}/finish", s.finishAttempt)
	mux.HandleFunc("POST /api/results", s.saveResult)
	mux.HandleFunc("POST /api/results/offline", s.saveOfflineResult)
	mux.HandleFunc("GET /api/ranking", s.ranking)
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		root := env("STATIC_DIR", "../dist")
		name := filepath.Clean(r.URL.Path)
		if name == "/" {
			name = "/index.html"
		}
		path := filepath.Join(root, name)
		if _, err := os.Stat(path); err != nil {
			http.NotFound(w, r)
			return
		}
		if strings.HasSuffix(name, ".html") || name == "/sw.js" {
			w.Header().Set("Cache-Control", "no-cache")
		}
		http.ServeFile(w, r, path)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if strings.HasPrefix(r.URL.Path, "/api/") && !s.allowed(w, r) {
			return
		}
		mux.ServeHTTP(w, r)
	})
}
func (s *Server) createRoom(w http.ResponseWriter, r *http.Request) {
	diff := "medium"
	var req struct {
		Difficulty string `json:"difficulty"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Difficulty == "easy" || req.Difficulty == "medium" || req.Difficulty == "hard" {
			diff = req.Difficulty
		}
	}
	s.mu.Lock()
	if len(s.rooms) >= 500 {
		s.mu.Unlock()
		http.Error(w, "Сервер занят", 503)
		return
	}
	code := ""
	for {
		n, _ := rand.Int(rand.Reader, big.NewInt(10000))
		code = fmt.Sprintf("%04d", n)
		if s.rooms[code] == nil {
			break
		}
	}
	m := &Member{ID: token(), token: token(), Hero: 0, gone: time.Now()}
	room := &Room{Code: code, Host: m.ID, Phase: "lobby", Difficulty: diff, Members: []*Member{m}, ID: token(), Seed: seed(), created: time.Now()}
	s.rooms[code] = room
	s.mu.Unlock()
	send(w, map[string]any{"code": code, "token": m.token, "id": m.ID})
}
func (s *Server) joinRoom(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	room := s.rooms[r.PathValue("code")]
	if room == nil {
		s.mu.Unlock()
		http.Error(w, "Комната не найдена", 404)
		return
	}
	if room.Phase != "lobby" || len(room.Members) >= 4 {
		s.mu.Unlock()
		http.Error(w, "Комната заполнена или игра уже началась", 409)
		return
	}
	used := map[int]bool{}
	for _, m := range room.Members {
		used[m.Hero] = true
	}
	h := 0
	for used[h] {
		h++
	}
	m := &Member{ID: token(), token: token(), Hero: h, gone: time.Now()}
	room.Members = append(room.Members, m)
	s.broadcast(room)
	s.mu.Unlock()
	send(w, map[string]any{"code": room.Code, "token": m.token, "id": m.ID})
}

// Called under mu: only immutable bytes enter a bounded per-connection queue.
func (s *Server) broadcast(room *Room) {
	room.ServerTime = time.Now().UnixMilli()
	for _, m := range room.Members {
		if !m.gone.IsZero() {
			m.ReconnectDeadline = m.gone.Add(30 * time.Second).UnixMilli()
		} else {
			m.ReconnectDeadline = 0
		}
	}
	data, err := json.Marshal(room)
	if err != nil {
		log.Printf("snapshot room=%s: %v", room.ID, err)
		return
	}
	for _, m := range room.Members {
		if m.conn != nil && m.out != nil {
			select {
			case m.out <- data:
			default:
				select {
				case <-m.out:
				default:
				}
				select {
				case m.out <- data:
				default:
				}
			}
		}
	}
}
func socketWriter(c *websocket.Conn, out <-chan []byte, done <-chan struct{}) {
	for {
		select {
		case <-done:
			return
		case data := <-out:
			_ = c.SetWriteDeadline(time.Now().Add(150 * time.Millisecond))
			if err := c.WriteMessage(websocket.TextMessage, data); err != nil {
				_ = c.Close()
				return
			}
		}
	}
}

// Only one persistence job per room; immutable players and DB work stay outside mu.
func (s *Server) persistRoom(room *Room) {
	if room.persistBusy || room.Persistence == "saved" || room.Engine == nil || room.Engine.allDead() {
		return
	}
	room.persistBusy = true
	room.Persistence = "pending"
	room.persistAttempts++
	id, players, finished, diff := room.ID, append([]Body(nil), room.Engine.Players...), room.finished, room.Difficulty
	go func() {
		err := s.record(id, players, finished, diff)
		s.mu.Lock()
		defer s.mu.Unlock()
		room.persistBusy = false
		if err != nil {
			room.Persistence = "error"
			room.PersistenceError = "database_unavailable"
			room.persistNext = time.Now().Add(time.Duration(room.persistAttempts) * time.Second)
			log.Printf("persist room=%s attempt=%d: %v", id, room.persistAttempts, err)
		} else {
			room.Persistence = "saved"
			room.PersistenceError = ""
		}
		s.broadcast(room)
	}()
}

// A disconnected client can obtain an authoritative deadline without putting credentials in URLs.
func (s *Server) roomStatus(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token string `json:"token"`
	}
	if !decode(w, r, &req) {
		return
	}
	s.mu.Lock()
	room := s.rooms[r.PathValue("code")]
	var data []byte
	if room != nil && req.Token != "" {
		for _, m := range room.Members {
			if m.token == req.Token {
				room.ServerTime = time.Now().UnixMilli()
				for _, other := range room.Members {
					if !other.gone.IsZero() {
						other.ReconnectDeadline = other.gone.Add(30 * time.Second).UnixMilli()
					}
				}
				data, _ = json.Marshal(room)
			}
		}
	}
	s.mu.Unlock()
	if data == nil {
		apiError(w, 404, "room_unavailable", "Сессия комнаты недоступна", false)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(data)
}

func (s *Server) socket(w http.ResponseWriter, r *http.Request) {
	// Authenticate in the first frame so credentials do not enter access-log URLs.
	up := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }, Subprotocols: []string{"jump-v2"}}
	c, err := up.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer c.Close()
	c.SetReadLimit(4096)
	_ = c.SetReadDeadline(time.Now().Add(5 * time.Second))
	var auth struct {
		Token string `json:"token"`
	}
	if c.ReadJSON(&auth) != nil {
		return
	}
	s.mu.Lock()
	room := s.rooms[r.PathValue("code")]
	var member *Member
	if room != nil {
		for _, m := range room.Members {
			if m.token == auth.Token && auth.Token != "" {
				member = m
			}
		}
	}
	if member != nil && room.Engine != nil && !member.gone.IsZero() && time.Since(member.gone) > 30*time.Second {
		member = nil
	}
	if member != nil && room.Engine != nil {
		for i, m := range room.Members {
			if m == member && !room.Engine.Players[i].Eligible {
				member = nil
				break
			}
		}
	}
	if member == nil {
		s.mu.Unlock()
		_ = c.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1008, "Сессия истекла"), time.Now().Add(time.Second))
		return
	}
	if member.conn != nil {
		_ = member.conn.Close()
	}
	member.conn = c
	member.out = make(chan []byte, 2)
	writerDone := make(chan struct{})
	defer close(writerDone)
	go socketWriter(c, member.out, writerDone)
	member.Connected = true
	member.gone = time.Time{}
	s.broadcast(room)
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		if member.conn == c {
			member.conn = nil
			member.Connected = false
			member.Ready = false
			if member.gone.IsZero() {
				member.gone = time.Now()
			}
			if room.Engine != nil {
				for i, m := range room.Members {
					if m == member {
						room.Engine.Players[i].Held = false
					}
				}
			}
			s.broadcast(room)
		}
	}()
	c.SetPongHandler(func(string) error { return c.SetReadDeadline(time.Now().Add(45 * time.Second)) })
	windowStart := time.Now()
	messages := 0
	for {
		_ = c.SetReadDeadline(time.Now().Add(45 * time.Second))
		var msg struct {
			Type       string `json:"type"`
			Hero       int    `json:"hero"`
			Pressed    bool   `json:"pressed"`
			Difficulty string `json:"difficulty"`
		}
		if c.ReadJSON(&msg) != nil {
			return
		}
		if time.Since(windowStart) > time.Second {
			windowStart = time.Now()
			messages = 0
		}
		messages++
		if messages > 150 {
			return
		}
		s.mu.Lock()
		if member.conn != c {
			s.mu.Unlock()
			return
		}
		idx := -1
		for i, m := range room.Members {
			if m == member {
				idx = i
			}
		}
		if idx < 0 {
			s.mu.Unlock()
			return
		}
		switch msg.Type {
		case "difficulty":
			if room.Host == member.ID && room.Phase == "lobby" {
				if msg.Difficulty == "easy" || msg.Difficulty == "medium" || msg.Difficulty == "hard" {
					room.Difficulty = msg.Difficulty
				}
			}
		case "hero":
			if room.Phase == "lobby" && msg.Hero >= 0 && msg.Hero < 7 {
				if member.Hero != msg.Hero {
					member.Hero = msg.Hero
					member.Ready = false
				}
			}
		case "ready":
			if room.Phase == "lobby" || room.Phase == "between" || room.Phase == "failed" {
				member.Ready = true
			}
		case "start":
			if room.Host == member.ID && (room.Phase == "lobby" || room.Phase == "between" || room.Phase == "failed") && len(room.Members) >= 2 {
				ready := true
				var heroes, totals []int
				level := 0
				if room.Engine != nil {
					level = room.Engine.Level + 1
					if room.Phase == "failed" {
						level = room.Engine.Level
					}
				}
				for i, m := range room.Members {
					if room.Engine == nil || room.Engine.Players[i].Eligible {
						ready = ready && m.Ready && m.Connected
					}
					heroes = append(heroes, m.Hero)
					if room.Engine != nil {
						score := room.Engine.Players[i].Score
						if room.Phase == "failed" {
							score -= room.Engine.Players[i].RoundScore
						}
						totals = append(totals, score)
					}
				}
				if ready && level < journeyStages {
					previous := room.Engine
					room.Engine = newEngineWithDifficulty(room.Seed, level, heroes, totals, room.Difficulty)
					if previous != nil {
						for i := range room.Engine.Players {
							room.Engine.Players[i].Eligible = previous.Players[i].Eligible
						}
					}
					room.Phase = "playing"
					for _, m := range room.Members {
						m.Ready = false
					}
				}
			}
		case "jump", "duck", "cast", "dash":
			if room.Phase == "playing" && (msg.Type == "duck" && !msg.Pressed || time.Since(member.lastInput) >= 10*time.Millisecond) {
				room.Engine.input(Action{Player: idx, Kind: msg.Type, Pressed: msg.Pressed})
				member.lastInput = time.Now()
			}
		case "leave":
			_ = c.Close()
			member.gone = time.Now().Add(-31 * time.Second)
		case "ping":
			s.mu.Unlock()
			continue
		}
		s.broadcast(room)
		s.mu.Unlock()
	}
}
func (s *Server) loop(stop <-chan struct{}) {
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case now := <-ticker.C:
			s.mu.Lock()
			for code, room := range s.rooms {
				if now.Sub(room.created) > 2*time.Hour || (!room.finished.IsZero() && now.Sub(room.finished) > 10*time.Minute && (room.Persistence == "saved" || room.Persistence == "device-only")) {
					for _, m := range room.Members {
						if m.conn != nil {
							_ = m.conn.Close()
						}
					}
					delete(s.rooms, code)
					continue
				}
				for i := len(room.Members) - 1; i >= 0; i-- {
					m := room.Members[i]
					if !m.Connected && !m.gone.IsZero() && now.Sub(m.gone) > 30*time.Second {
						if room.Phase == "lobby" {
							room.Members = append(room.Members[:i], room.Members[i+1:]...)
							if room.Host == m.ID && len(room.Members) > 0 {
								room.Host = room.Members[0].ID
							}
						} else if room.Engine != nil {
							room.Engine.Players[i].Eligible = false
							if room.Host == m.ID {
								for j, other := range room.Members {
									if other.Connected && room.Engine.Players[j].Eligible {
										room.Host = other.ID
										break
									}
								}
							}
						}
					}
				}
				if len(room.Members) == 0 {
					delete(s.rooms, code)
					continue
				}
				if room.Phase == "playing" {
					for i, m := range room.Members {
						room.Engine.Players[i].Connected = m.Connected
					}
					room.Engine.step()
					maxTicks := 2000
					if room.Difficulty == "easy" {
						maxTicks = 1000
					} else if room.Difficulty == "hard" {
						maxTicks = 2500
					}
					if room.Engine.Tick >= maxTicks || room.Engine.allDead() {
						if room.Engine.allDead() {
							room.Phase = "finished"
							room.finished = now
							room.Persistence = "device-only"
						} else if room.Engine.Level == journeyStages-1 {
							room.Phase = "finished"
							room.finished = now
							s.persistRoom(room)
						} else {
							room.Phase = "between"
						}
						for _, m := range room.Members {
							m.Ready = false
						}
					}
				}
				if room.Phase == "finished" && room.Persistence == "error" && room.persistAttempts < 3 && now.After(room.persistNext) {
					s.persistRoom(room)
				}
				if room.Engine == nil || room.Phase != "playing" || room.Engine.Tick%3 == 0 {
					s.broadcast(room)
				}
			}
			for id, a := range s.attempts {
				if now.Sub(a.created) > 2*time.Hour {
					delete(s.attempts, id)
				}
			}
			s.mu.Unlock()
		}
	}
}
func (s *Server) createAttempt(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Count      int    `json:"count"`
		Difficulty string `json:"difficulty"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.Count < 1 || req.Count > 2 {
		http.Error(w, "Недопустимое число игроков", 400)
		return
	}
	if req.Difficulty == "" {
		req.Difficulty = "medium"
	}
	if req.Difficulty != "easy" && req.Difficulty != "medium" && req.Difficulty != "hard" {
		http.Error(w, "Недопустимая сложность", 400)
		return
	}
	s.mu.Lock()
	if len(s.attempts) >= 10000 {
		s.mu.Unlock()
		http.Error(w, "Сервер занят", 503)
		return
	}
	a := &Attempt{ID: token(), Token: token(), Seed: seed(), Count: req.Count, Difficulty: req.Difficulty, created: time.Now()}
	s.attempts[a.ID] = a
	s.mu.Unlock()
	send(w, a)
}
func (s *Server) finishAttempt(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token  string     `json:"token"`
		Heroes []int      `json:"heroes"`
		Logs   [][]Action `json:"logs"`
	}
	if !decode(w, r, &req) {
		return
	}
	s.mu.Lock()
	original := s.attempts[r.PathValue("id")]
	var a *Attempt
	if original != nil {
		copy := *original
		a = &copy
	}
	s.mu.Unlock()
	if a == nil || a.Token != req.Token || req.Token == "" || time.Since(a.created) > 2*time.Hour {
		apiError(w, 404, "proof_unavailable", "Попытка не найдена или истекла", false)
		return
	}
	if a.done {
		send(w, map[string]any{"id": a.ID, "players": a.players})
		return
	}
	minElapsed := 180 * time.Second
	maxTicks := 3000
	if a.Difficulty == "easy" {
		minElapsed = 60 * time.Second
		maxTicks = 1000
	} else if a.Difficulty == "medium" {
		minElapsed = 120 * time.Second
		maxTicks = 2000
	} else if a.Difficulty == "hard" {
		minElapsed = 150 * time.Second
		maxTicks = 2500
	}
	if time.Since(a.created) < minElapsed || time.Since(a.created) > 2*time.Hour || len(req.Heroes) != a.Count || len(req.Logs) != journeyStages {
		apiError(w, 400, "invalid_journey", "Незавершённое путешествие", false)
		return
	}
	used := map[int]bool{}
	for _, h := range req.Heroes {
		if h < 0 || h > 6 || used[h] {
			apiError(w, 400, "invalid_heroes", "Недопустимые герои", false)
			return
		}
		used[h] = true
	}
	var totals []int
	var engine *Engine
	for level, logs := range req.Logs {
		if len(logs) > 20000 {
			apiError(w, 400, "too_many_actions", "Слишком много действий", false)
			return
		}
		last := -1
		for _, action := range logs {
			if action.Tick < last || action.Tick < 0 || action.Tick >= maxTicks || action.Player < 0 || action.Player >= a.Count || (action.Kind != "jump" && action.Kind != "duck" && action.Kind != "cast" && action.Kind != "dash") {
				apiError(w, 400, "invalid_log", "Некорректный журнал", false)
				return
			}
			last = action.Tick
		}
		engine = newEngineWithDifficulty(a.Seed, level, req.Heroes, totals, a.Difficulty)
		next := 0
		for engine.Tick < maxTicks {
			for next < len(logs) && logs[next].Tick == engine.Tick {
				engine.input(logs[next])
				next++
			}
			engine.step()
			if engine.allDead() {
				apiError(w, 400, "journey_defeated", "Путешествие завершилось поражением", false)
				return
			}
		}
		totals = nil
		for _, p := range engine.Players {
			totals = append(totals, p.Score)
		}
	}
	if err := s.record(a.ID, engine.Players, time.Now(), a.Difficulty); err != nil {
		apiError(w, 503, "database_unavailable", "Не удалось сохранить результат", true)
		return
	}
	s.mu.Lock()
	original.done = true
	original.players = append([]Body(nil), engine.Players...)
	s.mu.Unlock()
	send(w, map[string]any{"id": a.ID, "players": engine.Players})
}
func (s *Server) record(id string, players []Body, now time.Time, difficulty string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if difficulty == "" {
		difficulty = "medium"
	}
	for i, p := range players {
		if p.Eligible {
			if _, err = tx.Exec("INSERT OR IGNORE INTO results(match_id,player,score,week,finished,difficulty,provenance) VALUES(?,?,?,?,?,?,'verified')", id, i, p.Score, week(now), now.Unix(), difficulty); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}
func (s *Server) saveResult(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID         string `json:"id"`
		Token      string `json:"token"`
		Player     int    `json:"player"`
		Name       string `json:"name"`
		Score      int    `json:"score,omitempty"`
		Difficulty string `json:"difficulty,omitempty"`
	}
	if !decode(w, r, &req) {
		return
	}
	name := strings.TrimSpace(req.Name)
	if len([]rune(name)) < 1 || len([]rune(name)) > 20 || strings.IndexFunc(name, unicode.IsControl) >= 0 {
		apiError(w, 400, "invalid_name", "Имя должно содержать от 1 до 20 символов", false)
		return
	}
	s.mu.Lock()
	valid := false
	if a := s.attempts[req.ID]; a != nil {
		valid = a.done && (a.created.IsZero() || time.Since(a.created) <= 2*time.Hour) && a.Token == req.Token && req.Token != "" && req.Player >= 0 && req.Player < a.Count
	}
	for _, room := range s.rooms {
		if room.ID == req.ID && room.Phase == "finished" && room.Engine != nil && !room.Engine.allDead() && req.Player >= 0 && req.Player < len(room.Members) && room.Members[req.Player].token == req.Token && req.Token != "" && room.Engine.Players[req.Player].Eligible {
			valid = true
			if room.Persistence != "saved" {
				s.persistRoom(room)
			}
		}
	}
	s.mu.Unlock()
	if !valid {
		apiError(w, 403, "proof_unavailable", "Подтверждение результата недоступно", false)
		return
	}
	s.nameResult(w, req.ID, req.Player, name)
}
func apiError(w http.ResponseWriter, status int, code, message string, retryable bool) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	send(w, map[string]any{"code": code, "message": message, "retryable": retryable})
}
func (s *Server) nameResult(w http.ResponseWriter, id string, player int, name string) {
	_, err := s.db.Exec("UPDATE results SET name=? WHERE match_id=? AND player=? AND name IS NULL", name, id, player)
	if err != nil {
		apiError(w, 503, "database_unavailable", "Не удалось записать имя", true)
		return
	}
	var saved sql.NullString
	err = s.db.QueryRow("SELECT name FROM results WHERE match_id=? AND player=?", id, player).Scan(&saved)
	if err == sql.ErrNoRows {
		apiError(w, 409, "result_pending", "Результат ещё не записан; повторите", true)
		return
	}
	if err != nil {
		apiError(w, 503, "database_unavailable", "База недоступна", true)
		return
	}
	if !saved.Valid || saved.String != name {
		apiError(w, 409, "name_conflict", "У результата уже другое имя", false)
		return
	}
	send(w, map[string]bool{"ok": true})
}
func (s *Server) saveOfflineResult(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID         string `json:"id"`
		Player     int    `json:"player"`
		Name       string `json:"name"`
		Score      int    `json:"score"`
		Difficulty string `json:"difficulty"`
	}
	if !decode(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.ID == "" || len(req.ID) > 150 || req.Player < 0 || req.Player > 3 || len([]rune(req.Name)) < 1 || len([]rune(req.Name)) > 20 || strings.IndexFunc(req.Name, unicode.IsControl) >= 0 || req.Score < 0 || req.Score > 500000 || (req.Difficulty != "easy" && req.Difficulty != "medium" && req.Difficulty != "hard") {
		apiError(w, 400, "invalid_offline_result", "Некорректный автономный результат", false)
		return
	}
	// Namespace prevents an offline submission from naming or replacing proven rows.
	id := "offline:" + req.ID
	now := time.Now()
	_, err := s.db.Exec("INSERT OR IGNORE INTO results(match_id,player,score,week,finished,name,difficulty,provenance) VALUES(?,?,?,?,?,?,?,'offline')", id, req.Player, req.Score, week(now), now.Unix(), req.Name, req.Difficulty)
	if err != nil {
		apiError(w, 503, "database_unavailable", "База недоступна", true)
		return
	}
	var score int
	var diff, name string
	err = s.db.QueryRow("SELECT score,difficulty,name FROM results WHERE match_id=? AND player=?", id, req.Player).Scan(&score, &diff, &name)
	if err != nil {
		apiError(w, 503, "database_unavailable", "База недоступна", true)
		return
	}
	if score != req.Score || diff != req.Difficulty || name != req.Name {
		apiError(w, 409, "offline_conflict", "Идентификатор уже использован", false)
		return
	}
	send(w, map[string]any{"ok": true, "provenance": "offline"})
}

func (s *Server) ranking(w http.ResponseWriter, r *http.Request) {
	current := week(time.Now())
	diff := r.URL.Query().Get("difficulty")
	if diff == "" {
		diff = "medium"
	}
	rows, err := s.db.Query("SELECT name,score,provenance FROM results WHERE week=? AND difficulty=? AND name IS NOT NULL ORDER BY score DESC,finished ASC,match_id ASC,player ASC LIMIT 20", current, diff)
	if err != nil {
		http.Error(w, "Рейтинг недоступен", 500)
		return
	}
	defer rows.Close()
	type Entry struct {
		Name       string `json:"name"`
		Score      int    `json:"score"`
		Provenance string `json:"provenance"`
	}
	entries := []Entry{}
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.Name, &e.Score, &e.Provenance); err != nil {
			http.Error(w, "Рейтинг недоступен", 500)
			return
		}
		entries = append(entries, e)
	}
	send(w, map[string]any{"week": current, "difficulty": diff, "entries": entries})
}
func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS results(
	match_id TEXT NOT NULL,
	player INTEGER NOT NULL,
	score INTEGER NOT NULL,
	week TEXT NOT NULL,
	finished INTEGER NOT NULL,
	name TEXT,
	difficulty TEXT NOT NULL DEFAULT 'medium',
	PRIMARY KEY(match_id,player)
);
`)
	if err != nil {
		return nil, err
	}
	_, _ = db.Exec("ALTER TABLE results ADD COLUMN provenance TEXT NOT NULL DEFAULT 'offline'")
	_, _ = db.Exec("ALTER TABLE results ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'medium'")
	_, _ = db.Exec(`
CREATE INDEX IF NOT EXISTS ranking_week ON results(week,score DESC);
CREATE INDEX IF NOT EXISTS ranking_week_diff ON results(week,difficulty,score DESC);
`)
	return db, nil
}
func main() {
	db, err := openDB(env("DB_PATH", "jump.sqlite"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	s := &Server{rooms: map[string]*Room{}, attempts: map[string]*Attempt{}, limits: map[string][]time.Time{}, db: db, origin: env("PUBLIC_ORIGIN", "http://localhost:5173")}
	stop := make(chan struct{})
	defer close(stop)
	go s.loop(stop)
	httpServer := &http.Server{Addr: env("LISTEN_ADDR", ":8080"), Handler: s.routes(), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	log.Printf("listening on %s", httpServer.Addr)
	if err := httpServer.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
