import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import User from '../../models/User.js';
import StoredUpload from '../../models/StoredUpload.js';
import { addExperienceMedia, deleteExperienceMedia, deleteWorkExperience } from '../../controllers/skillsController.js';

let mongoServer;

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

// Real JPEG magic bytes (0xFF 0xD8 0xFF), matched to the `.jpg` filenames used
// below -- hasValidAvatarFileSignature checks the signature against the
// extension in `originalname`, so the two must agree.
const validPngBuffer = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('rest-of-fake-jpeg-body')]);

const seedUserWithExperience = async () => {
  const user = new User({
    email: `${new mongoose.Types.ObjectId()}@example.com`,
    firstName: 'Test',
    lastName: 'Worker',
    role: 'work',
    status: 'active',
    workExperience: [
      { title: 'Designer', company: 'Acme', startDate: new Date('2020-01-01'), current: true },
    ],
  });
  await user.setPassword('Password123!');
  await user.save();
  return user;
};

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'experience-media-tests' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), StoredUpload.deleteMany({})]);
});

test('uploading a valid image attaches it to the right experience entry', async () => {
  const user = await seedUserWithExperience();
  const experienceId = user.workExperience[0]._id.toString();
  const req = {
    params: { experienceId },
    user: { id: user._id.toString() },
    file: { filename: 'experience-media_test_1.jpg', originalname: 'photo.jpg', buffer: validPngBuffer(), mimetype: 'image/png' },
  };
  const res = createResponse();

  await addExperienceMedia(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.data.workExperience[0].media.length, 1);
  assert.equal(res.payload.data.workExperience[0].media[0].filename, 'experience-media_test_1.jpg');
});

test('a file signature mismatch is rejected and never touches the experience', async () => {
  const user = await seedUserWithExperience();
  const experienceId = user.workExperience[0]._id.toString();
  const req = {
    params: { experienceId },
    user: { id: user._id.toString() },
    // .jpg extension in the filename, but a body that isn't a real image at all.
    file: { filename: 'fake.jpg', originalname: 'fake.jpg', buffer: Buffer.from('not an image'), mimetype: 'image/jpeg' },
  };
  const res = createResponse();

  await addExperienceMedia(req, res);

  assert.equal(res.statusCode, 400);
  const reloaded = await User.findById(user._id);
  assert.equal(reloaded.workExperience[0].media.length, 0);
});

test('the per-entry media cap is enforced', async () => {
  const user = await seedUserWithExperience();
  const experienceId = user.workExperience[0]._id.toString();

  for (let i = 0; i < 6; i += 1) {
    const req = {
      params: { experienceId },
      user: { id: user._id.toString() },
      file: { filename: `experience-media_test_${i}.jpg`, originalname: 'photo.jpg', buffer: validPngBuffer(), mimetype: 'image/png' },
    };
    const res = createResponse();
    await addExperienceMedia(req, res);
    assert.equal(res.statusCode, 201, `upload ${i} should succeed`);
  }

  const seventh = {
    params: { experienceId },
    user: { id: user._id.toString() },
    file: { filename: 'experience-media_test_6.jpg', originalname: 'photo.jpg', buffer: validPngBuffer(), mimetype: 'image/png' },
  };
  const res = createResponse();
  await addExperienceMedia(seventh, res);

  assert.equal(res.statusCode, 400);
  const reloaded = await User.findById(user._id);
  assert.equal(reloaded.workExperience[0].media.length, 6, 'the 7th upload must not be added');
});

test('deleting a media item removes only that item', async () => {
  const user = await seedUserWithExperience();
  const experienceId = user.workExperience[0]._id.toString();
  await addExperienceMedia({
    params: { experienceId },
    user: { id: user._id.toString() },
    file: { filename: 'a.jpg', originalname: 'a.jpg', buffer: validPngBuffer(), mimetype: 'image/png' },
  }, createResponse());
  const afterFirst = await addExperienceMedia({
    params: { experienceId },
    user: { id: user._id.toString() },
    file: { filename: 'b.jpg', originalname: 'b.jpg', buffer: validPngBuffer(), mimetype: 'image/png' },
  }, createResponse());
  void afterFirst;

  const reloaded = await User.findById(user._id);
  const [first, second] = reloaded.workExperience[0].media;

  const res = createResponse();
  await deleteExperienceMedia({
    params: { experienceId, mediaId: first._id.toString() },
    user: { id: user._id.toString() },
  }, res);

  assert.equal(res.statusCode, 200);
  const remaining = res.payload.data.workExperience[0].media;
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]._id.toString(), second._id.toString());
});

test('deleting an unknown media id returns 404', async () => {
  const user = await seedUserWithExperience();
  const experienceId = user.workExperience[0]._id.toString();
  const res = createResponse();

  await deleteExperienceMedia({
    params: { experienceId, mediaId: new mongoose.Types.ObjectId().toString() },
    user: { id: user._id.toString() },
  }, res);

  assert.equal(res.statusCode, 404);
});

test('deleting a whole experience entry cleans up its media blobs, not just the entry', async () => {
  const user = await seedUserWithExperience();
  const experienceId = user.workExperience[0]._id.toString();
  await addExperienceMedia({
    params: { experienceId },
    user: { id: user._id.toString() },
    file: { filename: 'orphan-check.jpg', originalname: 'x.jpg', buffer: validPngBuffer(), mimetype: 'image/png' },
  }, createResponse());

  // The controller's real cleanup path calls removeUploadFile -> deleteStoredUpload,
  // which only does anything if a StoredUpload document actually exists for that
  // filename — insert one so the cleanup has something real to remove.
  await StoredUpload.create({ filename: 'orphan-check.jpg', contentType: 'image/jpeg', data: validPngBuffer() });

  const res = createResponse();
  await deleteWorkExperience({ params: { experienceId }, user: { id: user._id.toString() } }, res);

  assert.equal(res.statusCode, 200);
  const reloaded = await User.findById(user._id);
  assert.equal(reloaded.workExperience.length, 0, 'the experience entry itself is gone');
  assert.equal(await StoredUpload.countDocuments({ filename: 'orphan-check.jpg' }), 0, 'its media blob must not be orphaned');
});
