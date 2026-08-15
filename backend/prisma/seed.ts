import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding candidate profiles for Discovery...');

  const sampleUsers = [
    {
      phone: '+11111111101',
      firebaseUid: 'demo_user_1',
      name: 'Sophia',
      dob: new Date('1998-05-14'),
      gender: 'female',
      bio: 'Coffee addict ☕, dog lover 🐕, and weekend hiker 🏔️. Looking for good conversation!',
      interestedIn: ['male', 'female'],
      latitude: 19.076,
      longitude: 72.8777,
      photos: [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      ],
    },
    {
      phone: '+11111111102',
      firebaseUid: 'demo_user_2',
      name: 'Emma',
      dob: new Date('1999-09-22'),
      gender: 'female',
      bio: 'Architect by day, amateur photographer by night 📷. Let us grab a matcha latte 🍵',
      interestedIn: ['male'],
      latitude: 19.082,
      longitude: 72.885,
      photos: [
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
      ],
    },
    {
      phone: '+11111111103',
      firebaseUid: 'demo_user_3',
      name: 'Liam',
      dob: new Date('1996-12-01'),
      gender: 'male',
      bio: 'Software dev & foodie. Always down to try new food spots 🍕🌮',
      interestedIn: ['female'],
      latitude: 19.07,
      longitude: 72.87,
      photos: [
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80',
      ],
    },
    {
      phone: '+11111165439',
      firebaseUid: 'user_3',
      name: 'Liam',
      dob: new Date('1996-12-01'),
      gender: 'male',
      bio: 'Software dev & foodie. Always down to try new food ',
      interestedIn: ['female'],
      latitude: 19.07,
      longitude: 72.87,
      photos: [
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80',
      ],
    },
    {
      phone: '+11111165466',
      firebaseUid: 'user_31',
      name: 'Jack',
      dob: new Date('1986-12-01'),
      gender: 'male',
      bio: 'Software dev & foodie. Always down to try new food ',
      interestedIn: ['male'],
      latitude: 1.07,
      longitude: 7.87,
      photos: [
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80',
      ],
    },
    {
      phone: '+11111165466',
      firebaseUid: 'user_31',
      name: 'Jack',
      dob: new Date('1986-12-01'),
      gender: 'male',
      bio: 'Software dev & foodie. Always down to try new food ',
      interestedIn: ['male'],
      latitude: 1.07,
      longitude: 7.87,
      photos: [
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80',
      ],
    },
    {
      phone: '+11111165477',
      firebaseUid: 'user_312',
      name: 'Jack',
      dob: new Date('1986-12-01'),
      gender: 'male',
      bio: 'Software dev & foodie. Always down to try new food ',
      interestedIn: ['male'],
      latitude: 1.07,
      longitude: 7.87,
      photos: [
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80',
      ],
    },
    {
      phone: '+11111111104',
      firebaseUid: 'demo_user_4',
      name: 'Maya',
      dob: new Date('2001-03-10'),
      gender: 'female',
      bio: 'Music enthusiast 🎧 & indie movie fan 🎬. Send me your playlist!',
      interestedIn: ['male', 'female'],
      latitude: 19.09,
      longitude: 72.86,
      photos: [
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80',
      ],
    },
  ];

  for (const u of sampleUsers) {
    const user = await prisma.user.upsert({
      where: { phone: u.phone },
      update: {},
      create: {
        phone: u.phone,
        firebaseUid: u.firebaseUid,
        phoneVerified: true,
      },
    });

    await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        name: u.name,
        dob: u.dob,
        gender: u.gender,
        bio: u.bio,
        interestedIn: u.interestedIn,
        latitude: u.latitude,
        longitude: u.longitude,
      },
      create: {
        userId: user.id,
        name: u.name,
        dob: u.dob,
        gender: u.gender,
        bio: u.bio,
        interestedIn: u.interestedIn,
        latitude: u.latitude,
        longitude: u.longitude,
      },
    });

    for (let i = 0; i < u.photos.length; i++) {
      const photoUrl = u.photos[i];
      const existing = await prisma.photo.findFirst({
        where: { userId: user.id, url: photoUrl },
      });
      if (!existing) {
        await prisma.photo.create({
          data: {
            userId: user.id,
            url: photoUrl,
            order: i,
            isVerified: true,
          },
        });
      }
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
