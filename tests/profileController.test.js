const request = require('supertest');

describe.skip('Profile assignment API', () => {
    let profilesCollection;
    let usersCollection;

    beforeAll(() => {
        profilesCollection = db.mainDb.collection('profiles');
        usersCollection = db.mainDb.collection('users');
    });

    beforeEach(async () => {
        await profilesCollection.deleteMany({});
        await usersCollection.deleteMany({});
    });

    it('assigns an existing profile to a user and returns normalized ids', async () => {
        const { insertedId: profileId } = await profilesCollection.insertOne({ profileName: 'Test Profile' });
        const { insertedId: userId } = await usersCollection.insertOne({ name: 'Test User', email: 'assign@example.com' });

        const res = await request(app)
            .post(`/api/v1/users/${userId.toString()}/assign-profile`)
            .send({ profileId: profileId.toString() });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'success');
        expect(res.body.data).toMatchObject({
            _id: userId.toString(),
            profileId: profileId.toString()
        });

        const updatedUser = await usersCollection.findOne({ _id: userId });
        expect(updatedUser.profileId).toBeDefined();
        expect(updatedUser.profileId.toString()).toBe(profileId.toString());
    });

    it('returns 400 when the provided profile id is malformed', async () => {
        const { insertedId: userId } = await usersCollection.insertOne({ name: 'Test User', email: 'bad-profile@example.com' });

        const res = await request(app)
            .post(`/api/v1/users/${userId.toString()}/assign-profile`)
            .send({ profileId: 'not-a-valid-id' });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('status', 'error');
        expect(Array.isArray(res.body.errors)).toBe(true);
        expect(res.body.errors[0]).toMatchObject({
            msg: 'profileId must be a valid ObjectId',
            param: 'profileId'
        });
    });

    it('returns 404 when the profile cannot be found', async () => {
        const { insertedId: userId } = await usersCollection.insertOne({ name: 'Test User', email: 'missing-profile@example.com' });

        const missingProfileId = '64b6f2f84d1c2a5f1b9d4c0a';

        const res = await request(app)
            .post(`/api/v1/users/${userId.toString()}/assign-profile`)
            .send({ profileId: missingProfileId });

        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty('status', 'error');
        expect(res.body).toHaveProperty('message', 'Profile not found');
    });
});
