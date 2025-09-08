const cameraService = require('../services/camera.service');
const kikVisionService = require('../services/hikVision.service');

class CameraController {
  /**
   * Get all cameras
   */
  async listCameras(loggedUserId) {
    return await cameraService.list(loggedUserId);
  }

  /**
   * Get all cameras by client_id
   */
  async listCamerasByClientId(loggedUserId, clientId) {
    return await cameraService.list(loggedUserId, clientId);
  }

  /**
   * Get a camera
   */
  async getCamera(loggedUserId, id) {
    return await cameraService.get(loggedUserId, id);
  }

  /**
   * Get a camera
   */
  async getPhoto(loggedUserId, id) {
    const camera = await cameraService.get(loggedUserId, id);
    return await kikVisionService.obterFotoCamera(camera.url, camera.login, camera.senha);
  }

  /**
   * Insert a camera
   */
  async insertCamera(loggedUserId, newCamera) {
    return await cameraService.insert(loggedUserId, newCamera);
  }

  /**
   * Update a camera
   */
  async updateCamera(loggedUserId, camera) {
    return await cameraService.update(loggedUserId, camera);
  }

  /**
   * Remove a camera
   */
  async removeCamera(loggedUserId, cameraId) {
    return await cameraService.remove(loggedUserId, cameraId);
  }
}

module.exports = new CameraController();
