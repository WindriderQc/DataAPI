class GeneralError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }

    getCode() {
        if (this instanceof BadRequest) {
            return 400;
        }
        if (this instanceof NotFoundError) {
            return 404;
        }
        return 500;
    }
}

class BadRequest extends GeneralError {
    constructor(validationErrors) {
        super('Validation Failed');
        this.errors = validationErrors;
    }
}
class NotFoundError extends GeneralError { }

module.exports = {
    GeneralError,
    BadRequest,
    NotFoundError
};
