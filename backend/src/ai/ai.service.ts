import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

  async generateIcebreakers(myUserId: string, targetUserId: string) {
    const [me, target] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: myUserId },
        include: { profile: { include: { prompts: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: targetUserId },
        include: { profile: { include: { prompts: true } }, photos: true },
      }),
    ]);

    if (!target || !target.profile) {
      throw new NotFoundException('Target user profile not found');
    }

    const myProfile = me?.profile;
    const targetProfile = target.profile;

    const myInterests = (myProfile?.interests as string[]) || [];
    const targetInterests = (targetProfile?.interests as string[]) || [];
    const sharedInterests = myInterests.filter((i) =>
      targetInterests.some((ti) => ti.toLowerCase() === i.toLowerCase()),
    );

    const targetPrompts = targetProfile.prompts || [];
    const targetName = targetProfile.name || 'there';
    const targetBio = targetProfile.bio || '';

    const starters: Array<{ id: string; category: string; text: string; emoji: string }> = [];

    // 1. Prompt-based icebreaker
    if (targetPrompts.length > 0) {
      const p = targetPrompts[0];
      starters.push({
        id: 'prompt_reply',
        category: 'Prompt Reply',
        emoji: '💭',
        text: `Saw your prompt "${p.question}" — "${p.answer}". I have so many questions! How did that happen?`,
      });
    }

    // 2. Shared interest icebreaker
    if (sharedInterests.length > 0) {
      const interest = sharedInterests[0];
      starters.push({
        id: 'shared_interest',
        category: 'Shared Passion',
        emoji: '🔥',
        text: `I noticed we both love ${interest}! What got you into it, or what's your favorite spot in town for it?`,
      });
    } else if (targetInterests.length > 0) {
      const interest = targetInterests[0];
      starters.push({
        id: 'curious_interest',
        category: 'Curious',
        emoji: '✨',
        text: `Hey ${targetName}! I saw you're really into ${interest}. Always wanted to learn more about that!`,
      });
    }

    // 3. Witty / Flirty playful icebreaker
    if (targetBio.length > 10) {
      starters.push({
        id: 'bio_tease',
        category: 'Playful',
        emoji: '😏',
        text: `Your bio gave me an instant smile. Quick question: are you as adventurous in person as your photos look?`,
      });
    } else {
      starters.push({
        id: 'casual_vibe',
        category: 'Smooth & Sweet',
        emoji: '☕',
        text: `Hey ${targetName}! On a scale from 1 to grabbing coffee this weekend, how spontaneous are you?`,
      });
    }

    // Fallbacks if fewer than 3
    if (starters.length < 3) {
      starters.push({
        id: 'debate_starter',
        category: 'Fun Debate',
        emoji: '🍕',
        text: `Important debate to break the ice: best pizza topping of all time, go!`,
      });
    }
    if (starters.length < 3) {
      starters.push({
        id: 'weekend_vibe',
        category: 'Weekend Question',
        emoji: '🌟',
        text: `What does your ideal Sunday look like: cozy indoors with movies, or out exploring the city?`,
      });
    }

    return {
      targetUserId,
      targetName,
      starters: starters.slice(0, 3),
    };
  }

  async getCompatibility(myUserId: string, targetUserId: string) {
    const [me, target] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: myUserId },
        include: { profile: { include: { prompts: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: targetUserId },
        include: { profile: { include: { prompts: true } }, photos: true },
      }),
    ]);

    if (!target || !target.profile) {
      throw new NotFoundException('Profile not found');
    }

    const myProfile = me?.profile;
    const targetProfile = target.profile;

    const myInterests = (myProfile?.interests as string[]) || [];
    const targetInterests = (targetProfile?.interests as string[]) || [];

    const sharedInterests = myInterests.filter((i) =>
      targetInterests.some((ti) => ti.toLowerCase() === i.toLowerCase()),
    );

    // Calculate dynamic base score
    let score = 74; // high default baseline for matches

    // Shared interests boost
    score += Math.min(sharedInterests.length * 6, 18);

    // Verified photo trust boost
    if (targetProfile.isVerified) score += 4;

    // Both have rich prompts boost
    if ((myProfile?.prompts?.length || 0) > 0 && (targetProfile.prompts?.length || 0) > 0) {
      score += 4;
    }

    // Cap between 78% and 98%
    score = Math.min(98, Math.max(78, score));

    const synergyPoints: string[] = [];

    if (sharedInterests.length > 0) {
      synergyPoints.push(`Shared passions: ${sharedInterests.join(', ')}`);
    } else {
      synergyPoints.push('Complementary lifestyle & personality vibes');
    }

    if (targetProfile.isVerified) {
      synergyPoints.push('Verified authentic profile badge 🛡️');
    }

    if (targetProfile.prompts && targetProfile.prompts.length > 0) {
      synergyPoints.push('Great conversationalist & prompt alignment 💬');
    }

    synergyPoints.push('High mutual communication compatibility');

    let badge = '✨ Great Match';
    if (score >= 90) badge = '🔥 High Chemistry';
    else if (score >= 85) badge = '💎 Rare Vibe Match';

    return {
      targetUserId,
      targetName: targetProfile.name,
      score,
      badge,
      sharedInterests,
      synergyPoints: synergyPoints.slice(0, 3),
    };
  }

  async generateBio(
    userId: string,
    vibe: 'funny' | 'romantic' | 'adventurous' | 'creative' = 'creative',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { include: { prompts: true } },
      },
    });

    const p = user?.profile;
    const name = p?.name || 'Someone';
    const interests = (p?.interests as string[]) || [];
    const interestStr = interests.length > 0 ? interests.slice(0, 3).join(', ') : 'coffee & good conversations';

    const bios: Array<{ id: string; title: string; bio: string; vibe: string }> = [];

    if (vibe === 'funny') {
      bios.push({
        id: 'funny-1',
        title: 'Humorous & Witty',
        vibe: 'funny',
        bio: `Professional overthinker, amateur ${interests[0] || 'chef'}, and 10/10 dog petter. Swipe right if you can handle someone who laughs at their own jokes before telling them.`,
      });
      bios.push({
        id: 'funny-2',
        title: 'Self-Deprecating & Charming',
        vibe: 'funny',
        bio: `I promise to never steal your fries (unless they are really crispy). Here for great vibes, spontaneous food runs, and someone who won't judge my playlist transitions.`,
      });
      bios.push({
        id: 'funny-3',
        title: 'Playful Sarcasm',
        vibe: 'funny',
        bio: `50% ${interestStr}, 50% wondering if I turned the stove off. Looking for a partner-in-crime for weekend adventures and competitive Mario Kart matches.`,
      });
    } else if (vibe === 'romantic') {
      bios.push({
        id: 'romantic-1',
        title: 'Deep & Intentional',
        vibe: 'romantic',
        bio: `Believer in late-night talks, slow mornings with warm coffee, and finding magic in the mundane. Passionate about ${interestStr}. Let's build something authentic.`,
      });
      bios.push({
        id: 'romantic-2',
        title: 'Sweet & Thoughtful',
        vibe: 'romantic',
        bio: `Looking for that effortless connection where minutes feel like seconds. Love thoughtful gestures, live music, and exploring hidden city gems together.`,
      });
      bios.push({
        id: 'romantic-3',
        title: 'Warm & Hopeless Romantic',
        vibe: 'romantic',
        bio: `Sunsets, honest conversations, and good food taste better with great company. Tell me about the best book you've read or your dream getaway.`,
      });
    } else if (vibe === 'adventurous') {
      bios.push({
        id: 'adventurous-1',
        title: 'Wanderlust & Thrill',
        vibe: 'adventurous',
        bio: `Passport ready, always searching for the next scenic viewpoint or hole-in-the-wall taco spot. Big fan of ${interestStr}. Where are we traveling first?`,
      });
      bios.push({
        id: 'adventurous-2',
        title: 'Spontaneous Explorer',
        vibe: 'adventurous',
        bio: `Work hard, explore harder. You can usually find me outdoors, trying new cuisines, or planning our next road trip. Let's make memories worth telling!`,
      });
      bios.push({
        id: 'adventurous-3',
        title: 'Active & Dynamic',
        vibe: 'adventurous',
        bio: `Life is too short for boring weekends. Seeking a fellow adventurer to conquer hiking trails, rooftop views, and spontaneous Sunday morning markets.`,
      });
    } else {
      bios.push({
        id: 'creative-1',
        title: 'Modern & Balanced',
        vibe: 'creative',
        bio: `Curator of cozy vibes, lover of ${interestStr}, and big believer in doing things that spark joy. Let's trade favorite music recommendations and grab coffee.`,
      });
      bios.push({
        id: 'creative-2',
        title: 'Vibrant & Open-Minded',
        vibe: 'creative',
        bio: `Fueled by matcha, curiosity, and good design. When I'm not diving into ${interests[0] || 'creative projects'}, I'm plotting my next weekend escape. Tell me what makes you smile!`,
      });
      bios.push({
        id: 'creative-3',
        title: 'Authentic & Aesthetic',
        vibe: 'creative',
        bio: `Appreciator of little moments, deep laughs, and genuine people. Passionate about ${interestStr}. Let's skip small talk and share our wildest dreams.`,
      });
    }

    return {
      name,
      vibe,
      suggestions: bios,
    };
  }
}

