import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('Google profile did not include an email'));
          }

          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            create: {
              googleId: profile.id,
              name: profile.displayName,
              email,
              avatar: profile.photos?.[0]?.value ?? null,
            },
            update: {
              name: profile.displayName,
              avatar: profile.photos?.[0]?.value ?? null,
            },
          });

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
} else {
  logger.warn(
    'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set - Google OAuth login is disabled until configured.'
  );
}

export default passport;
