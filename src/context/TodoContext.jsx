import { createContext, useContext, useState, useCallback } from 'react';

const TodoContext = createContext(null);

const PASTEL_COLORS = [
  { bg: '#fef3c7', border: '#fde68a', text: '#92400e' },
  { bg: '#dbeafe', border: '#bfdbfe', text: '#1e40af' },
  { bg: '#fce7f3', border: '#fbcfe8', text: '#9d174d' },
  { bg: '#d1fae5', border: '#a7f3d0', text: '#065f46' },
  { bg: '#ede9fe', border: '#ddd6fe', text: '#5b21b6' },
  { bg: '#ffedd5', border: '#fed7aa', text: '#9a3412' },
  { bg: '#e0f2fe', border: '#bae6fd', text: '#075985' },
  { bg: '#fdf4ff', border: '#f5d0fe', text: '#7e22ce' },
];

export const getCardColor = (id) => {
  const idx = id ? id.charCodeAt(id.length - 1) % PASTEL_COLORS.length : 0;
  return PASTEL_COLORS[idx];
};

// Mock API — replace with real endpoints later
const mockApi = {
  getAll: () => Promise.resolve(JSON.parse(localStorage.getItem('todos') || '[]')),
  create: (todo) => {
    const todos = JSON.parse(localStorage.getItem('todos') || '[]');
    todos.push(todo);
    localStorage.setItem('todos', JSON.stringify(todos));
    return Promise.resolve(todo);
  },
  update: (id, updates) => {
    const todos = JSON.parse(localStorage.getItem('todos') || '[]');
    const idx = todos.findIndex(t => t.id === id);
    if (idx !== -1) todos[idx] = { ...todos[idx], ...updates };
    localStorage.setItem('todos', JSON.stringify(todos));
    return Promise.resolve(todos[idx]);
  },
  delete: (id) => {
    const todos = JSON.parse(localStorage.getItem('todos') || '[]');
    const filtered = todos.filter(t => t.id !== id);
    localStorage.setItem('todos', JSON.stringify(filtered));
    return Promise.resolve();
  },
};

export const TodoProvider = ({ children }) => {
  const [todos, setTodos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('todos') || '[]'); } catch { return []; }
  });

  const addTodo = useCallback(async (data) => {
    const newTodo = {
      id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: data.title,
      description: data.description || '',
      date: data.date,
      startTime: data.startTime || '',
      endTime: data.endTime || '',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    // Optimistic update
    setTodos(prev => [newTodo, ...prev]);
    try {
      await mockApi.create(newTodo);
    } catch {
      // Rollback
      setTodos(prev => prev.filter(t => t.id !== newTodo.id));
    }
    return newTodo;
  }, []);

  const toggleTodo = useCallback(async (id) => {
    let prev_status;
    setTodos(prev => prev.map(t => {
      if (t.id === id) {
        prev_status = t.status;
        return { ...t, status: t.status === 'active' ? 'completed' : 'active' };
      }
      return t;
    }));
    try {
      const todo = todos.find(t => t.id === id);
      await mockApi.update(id, { status: todo?.status === 'active' ? 'completed' : 'active' });
    } catch {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, status: prev_status } : t));
    }
  }, [todos]);

  const deleteTodo = useCallback(async (id) => {
    const snapshot = todos.find(t => t.id === id);
    setTodos(prev => prev.filter(t => t.id !== id));
    try {
      await mockApi.delete(id);
    } catch {
      if (snapshot) setTodos(prev => [snapshot, ...prev]);
    }
  }, [todos]);

  return (
    <TodoContext.Provider value={{ todos, addTodo, toggleTodo, deleteTodo }}>
      {children}
    </TodoContext.Provider>
  );
};

export const useTodos = () => useContext(TodoContext);
