/**
 * BaseRepository — generic CRUD wrapper around a Mongoose model.
 * All domain repositories extend this to get consistent query patterns
 * and a single place to add cross-cutting concerns (soft-delete, auditing, caching).
 *
 * FUTURE: Add Redis caching layer here — check cache before DB, invalidate on write.
 */
class BaseRepository {
  constructor(Model) {
    this.Model = Model;
  }

  async findById(id, projection = null) {
    return this.Model.findById(id, projection).lean();
  }

  async findOne(filter, projection = null) {
    return this.Model.findOne(filter, projection).lean();
  }

  async findMany(filter = {}, options = {}) {
    const { projection = null, sort = { createdAt: -1 }, skip = 0, limit = 20, populate = null } = options;
    let query = this.Model.find(filter, projection).sort(sort).skip(skip).limit(limit);
    if (populate) query = query.populate(populate);
    return query.lean();
  }

  async count(filter = {}) {
    return this.Model.countDocuments(filter);
  }

  async create(data) {
    const doc = new this.Model(data);
    await doc.save();
    return doc.toObject();
  }

  async updateById(id, update, options = { new: true }) {
    return this.Model.findByIdAndUpdate(id, update, { ...options, lean: true });
  }

  async updateOne(filter, update, options = { new: true }) {
    return this.Model.findOneAndUpdate(filter, update, { ...options, lean: true });
  }

  async deleteById(id) {
    return this.Model.findByIdAndDelete(id).lean();
  }

  async deleteMany(filter) {
    return this.Model.deleteMany(filter);
  }

  async exists(filter) {
    const doc = await this.Model.exists(filter);
    return !!doc;
  }
}

module.exports = { BaseRepository };
