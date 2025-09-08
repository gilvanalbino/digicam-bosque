class BaseRoute {
  /**
   * Retorna a lista de métodos do objeto, removendo o construtor e métodos que inicial com  "_"
   */
  static methods() {
    return Object.getOwnPropertyNames(this.prototype).filter(
      (method) => method !== 'constructor' && !method.startsWith('_')
    );
  }
}

module.exports = BaseRoute;
