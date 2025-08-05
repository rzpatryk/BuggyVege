class DatabaseAdapter {
    async createUser(userData) {
        throw new Error('Method must be implemented');
    }

    async getUser(userId) {
        throw new Error('Method must be implemented');
    }
    
   async getUserByEmail(email) {
        throw new Error('Method must be implemented');
    }

    async getUserById(id) {
        throw new Error('Method must be implemented');
    }

    async updateUser(id, userData) {
        throw new Error('Method must be implemented');
    }
}

module.exports = DatabaseAdapter;