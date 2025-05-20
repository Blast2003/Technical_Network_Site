import { sequelize } from './src/config/database.js';
import { User } from './src/models/userModel.js';
import {Post, UserPost} from "./src/models/postModel.js"
import { faker } from '@faker-js/faker';

(async () => {
  await sequelize.sync();

  // Count existing posts
  const existingCount = await Post.count();
  const targetTotal = 1000;
  const remaining = Math.max(0, targetTotal - existingCount);

  if (remaining === 0) {
    console.log(`Already have ${existingCount} posts, no seeding needed.`);
    process.exit(0);
  }

  const userIds = (await User.findAll({ attributes: ['id'] })).map(u => u.id);
  const batchSize = 100;

  for (let offset = 0; offset < remaining; offset += batchSize) {
    const batch = [];
    const postUserPairs = [];
    const batchLimit = Math.min(batchSize, remaining - offset);

    for (let i = 0; i < batchLimit; i++) {
      const index = existingCount + offset + i + 1;
      const title = faker.hacker.phrase();
      const text = Array.from({ length: 2 }, () => faker.hacker.phrase()).join("");
      const type = 'PerformanceTest';
      const hashtag = '#test';
      const mainField = faker.helpers.arrayElement([
        'Emerging Technologies',
        'Software & Application Development',
        'Data & Intelligence',
        'Security & Operations Management',
        'Core Infrastructure & Operations'
      ]);
      const sourceType = 'Synthetic';

      batch.push({ title: `${title} #${index}`, text, img: null, type, hashtag, mainField, sourceType });
    }

    const created = await Post.bulkCreate(batch, { returning: true });

    for (const post of created) {
      const randomUserId = faker.helpers.arrayElement(userIds);
      postUserPairs.push({ user_id: randomUserId, post_id: post.id });
    }

    await UserPost.bulkCreate(postUserPairs);
    console.log(`Inserted ${Math.min(existingCount + offset + batchLimit, targetTotal)} of ${targetTotal} posts...`);
  }

  console.log('Seeding complete!');
  process.exit(0);
})();