import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Play, Pause, Square, Plus, ChevronRight, ChevronDown, BookOpen,
  Clock, TrendingUp, Trash2, Flame, X, Check, ClipboardList, BarChart2
} from "lucide-react";

// ---------- Design tokens ----------
const C = {
  bg: "#12161D",
  surface: "#1B212C",
  surface2: "#232B38",
  border: "#313B4C",
  borderSoft: "#262E3B",
  text: "#EDE9DE",
  muted: "#8C93A6",
  faint: "#5C6478",
  accent: "#F2B84B",
  accentDim: "#8A6A2E",
  green: "#7FBF8F",
  red: "#E2725B",
};
const serif = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
const mono = "'SFMono-Regular', 'Courier New', monospace";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtHMS = (secs) => {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};
const fmtMin = (secs) => {
  const totalMin = Math.round(secs / 60);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};
const dayLabel = (dateStr) => {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  return d.toLocaleDateString(undefined, { weekday: "short" });
};

const STORAGE_KEY = "study-tracker-data";

const DEFAULT_DATA = { subjects: [], sessions: [] };

export default function StudyTracker() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("today");
  const [timer, setTimer] = useState(null); // {subjectId, chapterId, taskId, startedAt}
  const [tick, setTick] = useState(0);
  const saveTimeout = useRef(null);

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setData({ subjects: parsed.subjects || [], sessions: parsed.sessions || [] });
      }
    } catch (e) {
      // no existing data yet
    } finally {
      setLoaded(true);
    }
  }, []);

  // Save (debounced)
  const persist = useCallback((next) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error("Save failed", e);
      }
    }, 300);
  }, []);

  const updateData = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persist(next);
      return next;
    });
  }, [persist]);

  // Timer tick
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const elapsed = timer ? Math.floor((Date.now() - timer.startedAt) / 1000) : 0;

  const startTimer = (subjectId, chapterId, taskId) => {
    if (timer) return;
    setTimer({ subjectId, chapterId, taskId, startedAt: Date.now() });
  };

  const stopTimer = () => {
    if (!timer) return;
    const secs = Math.floor((Date.now() - timer.startedAt) / 1000);
    if (secs >= 5) {
      const subject = data.subjects.find((s) => s.id === timer.subjectId);
      const chapter = subject?.chapters.find((c) => c.id === timer.chapterId);
      const task = chapter?.tasks.find((t) => t.id === timer.taskId);
      const session = {
        id: uid(),
        subjectId: timer.subjectId,
        chapterId: timer.chapterId,
        taskId: timer.taskId,
        subjectName: subject?.name || "Unknown",
        chapterName: chapter?.name || "Unknown",
        taskName: task?.name || "Unknown",
        seconds: secs,
        date: todayStr(),
        loggedAt: Date.now(),
      };
      updateData((prev) => ({ ...prev, sessions: [session, ...prev.sessions] }));
    }
    setTimer(null);
  };

  const addManualSession = (session) => {
    updateData((prev) => ({ ...prev, sessions: [session, ...prev.sessions] }));
  };

  const deleteSession = (id) => {
    updateData((prev) => ({ ...prev, sessions: prev.sessions.filter((s) => s.id !== id) }));
  };

  const addSubject = (name) => {
    updateData((prev) => ({
      ...prev,
      subjects: [...prev.subjects, { id: uid(), name, chapters: [] }],
    }));
  };
  const addChapter = (subjectId, name) => {
    updateData((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id === subjectId ? { ...s, chapters: [...s.chapters, { id: uid(), name, tasks: [] }] } : s
      ),
    }));
  };
  const addTask = (subjectId, chapterId, name) => {
    updateData((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id !== subjectId
          ? s
          : {
              ...s,
              chapters: s.chapters.map((c) =>
                c.id === chapterId ? { ...c, tasks: [...c.tasks, { id: uid(), name }] } : c
              ),
            }
      ),
    }));
  };
  const deleteSubject = (subjectId) => {
    updateData((prev) => ({ ...prev, subjects: prev.subjects.filter((s) => s.id !== subjectId) }));
  };
  const deleteChapter = (subjectId, chapterId) => {
    updateData((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id !== subjectId ? s : { ...s, chapters: s.chapters.filter((c) => c.id !== chapterId) }
      ),
    }));
  };
  const deleteTask = (subjectId, chapterId, taskId) => {
    updateData((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id !== subjectId
          ? s
          : {
              ...s,
              chapters: s.chapters.map((c) =>
                c.id !== chapterId ? c : { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }
              ),
            }
      ),
    }));
  };

  if (!loaded) {
    return (
      <div style={{ background: C.bg, color: C.muted, fontFamily: serif }} className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Opening ledger…</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: "system-ui, -apple-system, sans-serif" }} className="min-h-screen pb-20">
      <Header timer={timer} elapsed={elapsed} onStop={stopTimer} data={data} />
      <main className="max-w-md mx-auto px-4 pt-4">
        {tab === "today" && (
          <TodayView
            data={data}
            timer={timer}
            elapsed={elapsed}
            onStart={startTimer}
            onStop={stopTimer}
            onDeleteSession={deleteSession}
            onAddManualSession={addManualSession}
          />
        )}
        {tab === "manage" && (
          <ManageView
            data={data}
            onAddSubject={addSubject}
            onAddChapter={addChapter}
            onAddTask={addTask}
            onDeleteSubject={deleteSubject}
            onDeleteChapter={deleteChapter}
            onDeleteTask={deleteTask}
          />
        )}
        {tab === "analytics" && <AnalyticsView data={data} />}
      </main>
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

// ---------- Header ----------
function Header({ timer, elapsed, onStop, data }) {
  let label = null;
  if (timer) {
    const subject = data.subjects.find((s) => s.id === timer.subjectId);
    const chapter = subject?.chapters.find((c) => c.id === timer.chapterId);
    const task = chapter?.tasks.find((t) => t.id === timer.taskId);
    label = `${subject?.name || ""} › ${chapter?.name || ""} › ${task?.name || ""}`;
  }
  return (
    <div style={{ borderBottom: `1px solid ${C.borderSoft}` }} className="sticky top-0 z-10 backdrop-blur" >
      <div style={{ background: `${C.bg}E6` }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div style={{ fontFamily: serif }} className="text-lg tracking-wide">
            The Study Ledger
          </div>
          {timer && (
            <button
              onClick={onStop}
              style={{ background: C.accent, color: "#1A1305" }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-semibold active:opacity-80"
            >
              <Square size={13} fill="#1A1305" />
              <span style={{ fontFamily: mono }}>{fmtHMS(elapsed)}</span>
            </button>
          )}
        </div>
        {timer && (
          <div className="max-w-md mx-auto px-4 pb-2 -mt-1 text-xs truncate" style={{ color: C.accent }}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Bottom Nav ----------
function BottomNav({ tab, setTab }) {
  const items = [
    { id: "today", label: "Today", icon: ClipboardList },
    { id: "manage", label: "Subjects", icon: BookOpen },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
  ];
  return (
    <div
      style={{ background: C.surface, borderTop: `1px solid ${C.borderSoft}` }}
      className="fixed bottom-0 left-0 right-0 z-10"
    >
      <div className="max-w-md mx-auto grid grid-cols-3">
        {items.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex flex-col items-center gap-1 py-2.5"
              style={{ color: active ? C.accent : C.muted }}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
              <span className="text-[11px]" style={{ fontWeight: active ? 600 : 400 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Today View ----------
function TodayView({ data, timer, elapsed, onStart, onStop, onDeleteSession, onAddManualSession }) {
  const [picking, setPicking] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const today = todayStr();
  const todaysSessions = data.sessions.filter((s) => s.date === today);
  const totalToday = todaysSessions.reduce((a, s) => a + s.seconds, 0);
  const hasAnySubject = data.subjects.length > 0;

  return (
    <div className="space-y-5">
      {/* Total today */}
      <div style={{ background: C.surface, border: `1px solid ${C.borderSoft}` }} className="rounded-sm px-4 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs" style={{ color: C.muted }}>Logged today</div>
          <div style={{ fontFamily: mono }} className="text-2xl mt-0.5">{fmtMin(totalToday)}</div>
        </div>
        <Clock size={26} style={{ color: C.accentDim }} />
      </div>

      {/* Timer control */}
      {!timer ? (
        <div>
          {hasAnySubject ? (
            <button
              onClick={() => setPicking(true)}
              style={{ background: C.accent, color: "#1A1305" }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-sm font-semibold active:opacity-85"
            >
              <Play size={16} fill="#1A1305" /> Start studying
            </button>
          ) : (
            <div style={{ border: `1px dashed ${C.border}`, color: C.muted }} className="rounded-sm px-4 py-4 text-sm text-center">
              Add a subject in the <span style={{ color: C.accent }}>Subjects</span> tab to start logging time.
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: C.surface2, border: `1px solid ${C.accentDim}` }} className="rounded-sm px-4 py-4 flex items-center justify-between">
          <div style={{ fontFamily: mono }} className="text-3xl" >{fmtHMS(elapsed)}</div>
          <button onClick={onStop} style={{ background: C.red }} className="p-2.5 rounded-full active:opacity-80">
            <Square size={16} fill="#12161D" color="#12161D" />
          </button>
        </div>
      )}

      {picking && (
        <TaskPicker
          data={data}
          onCancel={() => setPicking(false)}
          onPick={(subjectId, chapterId, taskId) => {
            onStart(subjectId, chapterId, taskId);
            setPicking(false);
          }}
        />
      )}

      {/* Manual add */}
      <button
        onClick={() => setManualOpen((v) => !v)}
        className="text-xs flex items-center gap-1"
        style={{ color: C.muted }}
      >
        <Plus size={13} /> Log a past session
      </button>
      {manualOpen && (
        <ManualLogForm
          data={data}
          onCancel={() => setManualOpen(false)}
          onSave={(session) => {
            onAddManualSession(session);
            setManualOpen(false);
          }}
        />
      )}

      {/* Ledger */}
      <div>
        <div style={{ fontFamily: serif, color: C.muted }} className="text-sm mb-2 mt-6">
          Today's entries
        </div>
        {todaysSessions.length === 0 ? (
          <div className="text-sm py-6 text-center" style={{ color: C.faint }}>
            No sessions logged yet today.
          </div>
        ) : (
          <div style={{ borderTop: `1px solid ${C.borderSoft}` }}>
            {todaysSessions.map((s) => (
              <LedgerRow key={s.id} session={s} onDelete={() => onDeleteSession(s.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LedgerRow({ session, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div
      style={{ borderBottom: `1px solid ${C.borderSoft}` }}
      className="flex items-center justify-between py-2.5"
    >
      <div className="min-w-0 pr-2">
        <div style={{ fontFamily: serif }} className="text-sm truncate">{session.taskName}</div>
        <div className="text-xs truncate" style={{ color: C.muted }}>
          {session.subjectName} › {session.chapterName}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span style={{ fontFamily: mono, color: C.accent }} className="text-sm">{fmtMin(session.seconds)}</span>
        {confirm ? (
          <button onClick={onDelete} style={{ color: C.red }} className="text-xs underline">confirm</button>
        ) : (
          <button onClick={() => setConfirm(true)} style={{ color: C.faint }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Task Picker ----------
function TaskPicker({ data, onPick, onCancel }) {
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id || "");
  const subject = data.subjects.find((s) => s.id === subjectId);
  const [chapterId, setChapterId] = useState(subject?.chapters[0]?.id || "");
  const chapter = subject?.chapters.find((c) => c.id === chapterId);
  const [taskId, setTaskId] = useState(chapter?.tasks[0]?.id || "");

  useEffect(() => {
    const s = data.subjects.find((s) => s.id === subjectId);
    setChapterId(s?.chapters[0]?.id || "");
  }, [subjectId]); // eslint-disable-line
  useEffect(() => {
    const c = subject?.chapters.find((c) => c.id === chapterId);
    setTaskId(c?.tasks[0]?.id || "");
  }, [chapterId]); // eslint-disable-line

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}` }} className="rounded-sm p-4 space-y-3">
      <Select label="Subject" value={subjectId} onChange={setSubjectId} options={data.subjects.map((s) => [s.id, s.name])} />
      <Select label="Chapter" value={chapterId} onChange={setChapterId} options={(subject?.chapters || []).map((c) => [c.id, c.name])} />
      <Select label="Task" value={taskId} onChange={setTaskId} options={(chapter?.tasks || []).map((t) => [t.id, t.name])} />
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
        <button
          disabled={!taskId}
          onClick={() => onPick(subjectId, chapterId, taskId)}
          style={{ background: taskId ? C.accent : C.surface2, color: taskId ? "#1A1305" : C.faint }}
          className="flex-1 py-2 rounded-sm text-sm font-semibold"
        >
          Start
        </button>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="text-xs mb-1" style={{ color: C.muted }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
        className="w-full rounded-sm px-2 py-2 text-sm"
      >
        {options.length === 0 && <option value="">—</option>}
        {options.map(([id, name]) => (
          <option key={id} value={id}>{name}</option>
        ))}
      </select>
    </label>
  );
}

// ---------- Manual Log Form ----------
function ManualLogForm({ data, onSave, onCancel }) {
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id || "");
  const subject = data.subjects.find((s) => s.id === subjectId);
  const [chapterId, setChapterId] = useState(subject?.chapters[0]?.id || "");
  const chapter = subject?.chapters.find((c) => c.id === chapterId);
  const [taskId, setTaskId] = useState(chapter?.tasks[0]?.id || "");
  const [minutes, setMinutes] = useState(25);
  const [date, setDate] = useState(todayStr());

  useEffect(() => {
    const s = data.subjects.find((s) => s.id === subjectId);
    setChapterId(s?.chapters[0]?.id || "");
  }, [subjectId]); // eslint-disable-line
  useEffect(() => {
    const c = subject?.chapters.find((c) => c.id === chapterId);
    setTaskId(c?.tasks[0]?.id || "");
  }, [chapterId]); // eslint-disable-line

  if (data.subjects.length === 0) {
    return (
      <div style={{ color: C.muted }} className="text-sm">Add a subject first in the Subjects tab.</div>
    );
  }

  const task = chapter?.tasks.find((t) => t.id === taskId);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}` }} className="rounded-sm p-4 space-y-3">
      <Select label="Subject" value={subjectId} onChange={setSubjectId} options={data.subjects.map((s) => [s.id, s.name])} />
      <Select label="Chapter" value={chapterId} onChange={setChapterId} options={(subject?.chapters || []).map((c) => [c.id, c.name])} />
      <Select label="Task" value={taskId} onChange={setTaskId} options={(chapter?.tasks || []).map((t) => [t.id, t.name])} />
      <div className="flex gap-3">
        <label className="flex-1">
          <div className="text-xs mb-1" style={{ color: C.muted }}>Minutes</div>
          <input
            type="number" min="1" value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
            className="w-full rounded-sm px-2 py-2 text-sm"
          />
        </label>
        <label className="flex-1">
          <div className="text-xs mb-1" style={{ color: C.muted }}>Date</div>
          <input
            type="date" value={date} max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
            className="w-full rounded-sm px-2 py-2 text-sm"
          />
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
        <button
          disabled={!taskId || !minutes}
          onClick={() =>
            onSave({
              id: uid(),
              subjectId, chapterId, taskId,
              subjectName: subject?.name, chapterName: chapter?.name, taskName: task?.name,
              seconds: Number(minutes) * 60,
              date,
              loggedAt: Date.now(),
            })
          }
          style={{ background: C.accent, color: "#1A1305" }}
          className="flex-1 py-2 rounded-sm text-sm font-semibold"
        >
          Save entry
        </button>
      </div>
    </div>
  );
}

// ---------- Manage View ----------
function ManageView({ data, onAddSubject, onAddChapter, onAddTask, onDeleteSubject, onDeleteChapter, onDeleteTask }) {
  const [newSubject, setNewSubject] = useState("");
  const [expanded, setExpanded] = useState({});

  return (
    <div className="space-y-4">
      <div style={{ fontFamily: serif, color: C.muted }} className="text-sm">Subjects</div>

      <div className="flex gap-2">
        <input
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="New subject (e.g. Organic Chemistry)"
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}
          className="flex-1 rounded-sm px-3 py-2 text-sm"
        />
        <button
          onClick={() => { if (newSubject.trim()) { onAddSubject(newSubject.trim()); setNewSubject(""); } }}
          style={{ background: C.accent, color: "#1A1305" }}
          className="px-3 rounded-sm"
        >
          <Plus size={16} />
        </button>
      </div>

      {data.subjects.length === 0 && (
        <div className="text-sm text-center py-6" style={{ color: C.faint }}>No subjects yet. Add your first one above.</div>
      )}

      {data.subjects.map((subject) => (
        <SubjectCard
          key={subject.id}
          subject={subject}
          expanded={!!expanded[subject.id]}
          onToggle={() => setExpanded((e) => ({ ...e, [subject.id]: !e[subject.id] }))}
          onAddChapter={(name) => onAddChapter(subject.id, name)}
          onAddTask={(chapterId, name) => onAddTask(subject.id, chapterId, name)}
          onDeleteSubject={() => onDeleteSubject(subject.id)}
          onDeleteChapter={(chapterId) => onDeleteChapter(subject.id, chapterId)}
          onDeleteTask={(chapterId, taskId) => onDeleteTask(subject.id, chapterId, taskId)}
        />
      ))}
    </div>
  );
}

function SubjectCard({ subject, expanded, onToggle, onAddChapter, onAddTask, onDeleteSubject, onDeleteChapter, onDeleteTask }) {
  const [newChapter, setNewChapter] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const totalTasks = subject.chapters.reduce((a, c) => a + c.tasks.length, 0);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.borderSoft}` }} className="rounded-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown size={16} color={C.muted} /> : <ChevronRight size={16} color={C.muted} />}
          <span style={{ fontFamily: serif }} className="truncate">{subject.name}</span>
        </div>
        <span className="text-xs shrink-0" style={{ color: C.faint }}>{subject.chapters.length} ch · {totalTasks} tasks</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
          {subject.chapters.map((chapter) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              onAddTask={(name) => onAddTask(chapter.id, name)}
              onDeleteChapter={() => onDeleteChapter(chapter.id)}
              onDeleteTask={(taskId) => onDeleteTask(chapter.id, taskId)}
            />
          ))}
          <div className="flex gap-2 pt-2">
            <input
              value={newChapter}
              onChange={(e) => setNewChapter(e.target.value)}
              placeholder="New chapter"
              style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
              className="flex-1 rounded-sm px-2 py-1.5 text-sm"
            />
            <button
              onClick={() => { if (newChapter.trim()) { onAddChapter(newChapter.trim()); setNewChapter(""); } }}
              style={{ border: `1px solid ${C.border}`, color: C.accent }}
              className="px-2.5 rounded-sm text-sm"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="pt-1">
            {confirmDel ? (
              <button onClick={onDeleteSubject} className="text-xs underline" style={{ color: C.red }}>Confirm delete subject</button>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="text-xs" style={{ color: C.faint }}>Delete subject</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChapterRow({ chapter, onAddTask, onDeleteChapter, onDeleteTask }) {
  const [open, setOpen] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div style={{ background: C.surface2, border: `1px solid ${C.borderSoft}` }} className="rounded-sm px-2.5 py-2">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {open ? <ChevronDown size={13} color={C.muted} /> : <ChevronRight size={13} color={C.muted} />}
          <span className="text-sm truncate">{chapter.name}</span>
        </div>
        <span className="text-xs shrink-0" style={{ color: C.faint }}>{chapter.tasks.length}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 pl-4">
          {chapter.tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between text-sm">
              <span style={{ color: C.text }} className="truncate">{task.name}</span>
              <button onClick={() => onDeleteTask(task.id)} style={{ color: C.faint }}><X size={13} /></button>
            </div>
          ))}
          <div className="flex gap-1.5 pt-1">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="New task"
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
              className="flex-1 rounded-sm px-2 py-1 text-xs"
            />
            <button
              onClick={() => { if (newTask.trim()) { onAddTask(newTask.trim()); setNewTask(""); } }}
              style={{ color: C.accent }}
              className="text-xs px-1.5"
            >
              <Plus size={13} />
            </button>
          </div>
          {confirmDel ? (
            <button onClick={onDeleteChapter} className="text-xs underline" style={{ color: C.red }}>Confirm delete chapter</button>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="text-xs" style={{ color: C.faint }}>Delete chapter</button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Analytics View ----------
function AnalyticsView({ data }) {
  const { sessions } = data;

  const totalAll = sessions.reduce((a, s) => a + s.seconds, 0);

  // last 7 days
  const days = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      arr.push(key);
    }
    return arr;
  }, []);
  const byDay = days.map((d) => ({
    date: d,
    seconds: sessions.filter((s) => s.date === d).reduce((a, s) => a + s.seconds, 0),
  }));
  const maxDay = Math.max(1, ...byDay.map((d) => d.seconds));
  const weekTotal = byDay.reduce((a, d) => a + d.seconds, 0);

  // streak
  const streak = useMemo(() => {
    let count = 0;
    let d = new Date();
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const has = sessions.some((s) => s.date === key);
      if (!has) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [sessions]);

  // by subject
  const bySubject = useMemo(() => {
    const map = {};
    sessions.forEach((s) => {
      map[s.subjectName] = (map[s.subjectName] || 0) + s.seconds;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [sessions]);
  const maxSubject = Math.max(1, ...bySubject.map(([, v]) => v));

  // by chapter for top subject
  const [selectedSubject, setSelectedSubject] = useState(null);
  const activeSubjectName = selectedSubject || bySubject[0]?.[0];
  const byChapter = useMemo(() => {
    const map = {};
    sessions.filter((s) => s.subjectName === activeSubjectName).forEach((s) => {
      map[s.chapterName] = (map[s.chapterName] || 0) + s.seconds;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [sessions, activeSubjectName]);
  const maxChapter = Math.max(1, ...byChapter.map(([, v]) => v));

  if (sessions.length === 0) {
    return (
      <div className="text-sm text-center py-10" style={{ color: C.faint }}>
        No study sessions logged yet. Start a timer from Today to see analytics here.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat row */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="This week" value={fmtMin(weekTotal)} />
        <StatBox label="All time" value={fmtMin(totalAll)} />
        <StatBox label="Streak" value={`${streak}d`} icon={streak > 0 ? Flame : null} />
      </div>

      {/* Weekly trend */}
      <div>
        <div style={{ fontFamily: serif, color: C.muted }} className="text-sm mb-3">Last 7 days</div>
        <div className="flex items-end justify-between gap-1.5" style={{ height: 110 }}>
          {byDay.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(4, (d.seconds / maxDay) * 88)}px`,
                  background: d.date === todayStr() ? C.accent : C.surface2,
                  border: `1px solid ${d.date === todayStr() ? C.accent : C.border}`,
                }}
                className="rounded-sm"
              />
              <div className="text-[10px] mt-1.5" style={{ color: C.faint }}>{dayLabel(d.date)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* By subject */}
      <div>
        <div style={{ fontFamily: serif, color: C.muted }} className="text-sm mb-2">Time by subject</div>
        <div className="space-y-2.5">
          {bySubject.map(([name, secs]) => (
            <button key={name} onClick={() => setSelectedSubject(name)} className="w-full text-left">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: name === activeSubjectName ? C.accent : C.text }}>{name}</span>
                <span style={{ fontFamily: mono, color: C.muted }}>{fmtMin(secs)}</span>
              </div>
              <div style={{ background: C.surface2, height: 6 }} className="rounded-sm overflow-hidden">
                <div style={{ width: `${(secs / maxSubject) * 100}%`, background: name === activeSubjectName ? C.accent : C.faint, height: "100%" }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* By chapter for selected subject */}
      {activeSubjectName && (
        <div>
          <div style={{ fontFamily: serif, color: C.muted }} className="text-sm mb-2">
            {activeSubjectName} — by chapter
          </div>
          <div className="space-y-2.5">
            {byChapter.map(([name, secs]) => (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{name}</span>
                  <span style={{ fontFamily: mono, color: C.muted }}>{fmtMin(secs)}</span>
                </div>
                <div style={{ background: C.surface2, height: 6 }} className="rounded-sm overflow-hidden">
                  <div style={{ width: `${(secs / maxChapter) * 100}%`, background: C.green, height: "100%" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon: Icon }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.borderSoft}` }} className="rounded-sm px-2.5 py-3 text-center">
      <div className="flex items-center justify-center gap-1">
        {Icon && <Icon size={13} color={C.accent} />}
        <div style={{ fontFamily: mono }} className="text-lg">{value}</div>
      </div>
      <div className="text-[10px] mt-1" style={{ color: C.faint }}>{label}</div>
    </div>
  );
}
