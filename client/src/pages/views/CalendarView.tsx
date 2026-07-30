import { useState, useMemo } from "react";
import type { List, Task } from "../../types";
import { PRIORITY_LAMP } from "./KanbanView";

interface Props {
  boardId: string;
  lists: List[];
  tasksByList: Record<string, Task[]>;
  filterFn: (task: Task) => boolean;
  onSelectTask: (task: Task) => void;
  fetchBoard: () => void;
}

export default function CalendarView({ lists, tasksByList, filterFn, onSelectTask }: Props) {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  
  const today = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const list of lists) {
      const listTasks = tasksByList[list._id] || [];
      for (const task of listTasks) {
        if (!filterFn(task) || !task.dueDate) continue;
        
        const dateObj = new Date(task.dueDate);
        const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
        
        const existing = map.get(dateKey) || [];
        existing.push(task);
        map.set(dateKey, existing);
      }
    }
    return map;
  }, [lists, tasksByList, filterFn]);

  // Generate calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
  
  // Previous month days to fill the first row
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const gridCells = [];
  
  // Add previous month filler days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    gridCells.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }
  
  // Add current month days
  for (let i = 1; i <= daysInMonth; i++) {
    gridCells.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  
  // Add next month filler days to complete 6 rows (42 cells)
  const remainingCells = 42 - gridCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    gridCells.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <div className="calendar-title">
          <h2>{monthNames[month]} {year}</h2>
        </div>
        <div className="calendar-nav">
          <button className="btn btn-secondary btn-sm" onClick={today}>Today</button>
          <button className="icon-btn" onClick={prevMonth} aria-label="Previous month">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button className="icon-btn" onClick={nextMonth} aria-label="Next month">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {/* Day of week headers */}
        {dayNames.map(day => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}
        
        {/* Calendar cells */}
        {gridCells.map((cell, i) => {
          const dateKey = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, "0")}-${String(cell.date.getDate()).padStart(2, "0")}`;
          const isToday = dateKey === todayStr;
          const dayTasks = tasksByDate.get(dateKey) || [];
          
          return (
            <div key={i} className={`calendar-cell ${!cell.isCurrentMonth ? "out-of-month" : ""} ${isToday ? "today" : ""}`}>
              <div className="calendar-date-num">{cell.date.getDate()}</div>
              
              <div className="calendar-cell-events">
                {dayTasks.map(task => (
                  <div
                    key={task._id}
                    className={`calendar-event ${task.status === "done" ? "completed" : ""}`}
                    style={{ "--event-color": task.priority && task.priority !== "medium" ? PRIORITY_LAMP[task.priority] : "var(--muted)" } as React.CSSProperties}
                    onClick={() => onSelectTask(task)}
                    title={task.title}
                  >
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
