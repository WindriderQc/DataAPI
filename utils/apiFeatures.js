class APIFeatures {
    constructor(query, queryString) {
        this.query = query;
        this.queryString = queryString;
    }

    paginate() {
        let { skip = 0, limit = 10, sort = 'desc' } = this.queryString;

        skip = parseInt(skip) || 0;
        limit = parseInt(limit) || 10;
        skip = skip < 0 ? 0 : skip;
        limit = Math.min(50, Math.max(1, limit)); // Clamp limit between 1 and 50

        this.query = this.query.skip(skip).limit(limit);

        // Store pagination details for metadata
        this.pagination = { skip, limit, sort };

        return this;
    }

    sort() {
        const sortBy = this.pagination.sort === 'desc' ? -1 : 1;
        this.query = this.query.sort({ created: sortBy });
        return this;
    }

    // A static method to execute the query and format the response
    static async execute(query, features) {
        const [total, data] = await Promise.all([
            query.model.countDocuments(query.getFilter()),
            features.query,
        ]);

        return {
            data,
            meta: {
                total,
                sort: features.pagination.sort,
                skip: features.pagination.skip,
                limit: features.pagination.limit,
                has_more: total - (features.pagination.skip + features.pagination.limit) > 0,
            },
        };
    }
}

module.exports = APIFeatures;