const userService = require('../services/user.service');

class UserController {
  /**
   * Get all users
   */
  async listUsers(loggedUserId) {
    return await userService.list(loggedUserId);
  }

  /**
   * Get all users by client_id
   */
  async listUsersByClientId(loggedUserId, clientId) {
    return await userService.list(loggedUserId, clientId);
  }

  /**
   * Get a user
   */
  async getUser(loggedUserId, id) {
    return await userService.get(loggedUserId, id);
  }

  /**
   * Insert a user
   */
  async insertUser(loggedUserId, newUser) {
    return await userService.insert(loggedUserId, newUser);
  }

  /**
   * Update a user
   */
  async updateUser(loggedUserId, user) {
    console.log('updateUser: ', user);
    return await userService.update(loggedUserId, user);
  }

  /**
   * Remove a user
   */
  async removeUser(loggedUserId, userId) {
    return await userService.remove(loggedUserId, userId);
  }
}

module.exports = new UserController();
