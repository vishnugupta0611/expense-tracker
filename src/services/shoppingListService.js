import api from './api';

export const shoppingListService = {
  // Get all shopping list items
  async getItems() {
    try {
      const response = await api.get('/shopping-list');
      return response.data;
    } catch (error) {
      console.error('Error fetching shopping list:', error);
      throw error;
    }
  },

  // Add a new item
  async addItem(itemData) {
    try {
      const response = await api.post('/shopping-list', itemData);
      return response.data;
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  },

  // Update an item
  async updateItem(id, updates) {
    try {
      const response = await api.put(`/shopping-list/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  },

  // Delete an item
  async deleteItem(id) {
    try {
      await api.delete(`/shopping-list/${id}`);
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  },

  // Clear all completed items
  async clearCompleted() {
    try {
      await api.delete('/shopping-list/completed');
      return true;
    } catch (error) {
      console.error('Error clearing completed items:', error);
      throw error;
    }
  }
};