/**
 * Rules of the login window (sign in, sign up « Particulier », sign up
 * « Professionnel »), in one place and in the visitor's language. The form
 * checks each field when the visitor leaves it, then again as they correct
 * it, instead of only at the end.
 */
import { z } from 'zod';
import { isValidTunisiaPhone, TUNISIA_PHONE_ERROR } from './phoneUtils';

export type LoginFormMode = 'login' | 'individual' | 'pro';

/** Minimum length of a new password (same rule as before, now written). */
export const PASSWORD_MIN = 6;

export const EMAIL_EMPTY = 'Saisissez votre adresse e-mail.';
export const EMAIL_INVALID = 'Adresse e-mail invalide (ex. : nom@gmail.com).';

const filled = (message: string) => z.string().trim().min(1, message);

const email = z.string().trim().min(1, EMAIL_EMPTY).email(EMAIL_INVALID);
const phone = z
  .string()
  .trim()
  .min(1, 'Saisissez votre numéro de téléphone.')
  .refine(isValidTunisiaPhone, TUNISIA_PHONE_ERROR);
const newPassword = z
  .string()
  .min(1, 'Choisissez un mot de passe.')
  .min(PASSWORD_MIN, `Au moins ${PASSWORD_MIN} caractères.`);
const firstName = filled('Saisissez votre prénom.');
const lastName = filled('Saisissez votre nom.');
const governorate = filled('Choisissez votre gouvernorat.');

export const loginFormSchemas = {
  // Sign in: the server decides whether the password is right.
  login: z.object({
    email,
    password: z.string().min(1, 'Saisissez votre mot de passe.'),
  }),
  individual: z.object({ firstName, lastName, governorate, phone, email, password: newPassword }),
  pro: z.object({
    shopName: filled('Saisissez le nom de la boutique.'),
    firstName,
    lastName,
    shopAddress: filled("Saisissez l'adresse de la boutique."),
    governorate,
    phone,
    email,
    password: newPassword,
  }),
} as const;

export interface LoginFormValues {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  governorate: string;
  phone: string;
  shopName: string;
  shopAddress: string;
}

export const emptyLoginForm: LoginFormValues = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  governorate: '',
  phone: '',
  shopName: '',
  shopAddress: '',
};

export const loginFormModeOf = (isSignUp: boolean, userType: 'individual' | 'pro'): LoginFormMode =>
  !isSignUp ? 'login' : userType === 'pro' ? 'pro' : 'individual';

/** First problem with the e-mail, or null (« Mot de passe oublié »). */
export function emailProblem(value: string): string | null {
  const result = email.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message ?? EMAIL_INVALID;
}
