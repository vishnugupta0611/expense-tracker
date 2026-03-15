import api from './api';

const scheduleService = {
  getAll: () => api.get('/schedule-events'),
  create: (data) => api.post('/schedule-events', data),
  update: (id, data) => api.put(`/schedule-events/${id}`, data),
  remove: (id) => api.delete(`/schedule-events/${id}`),
};

export default scheduleService;
