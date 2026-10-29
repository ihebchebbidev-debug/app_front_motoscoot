import { useMutation } from '@tanstack/react-query';
import { contactApi, ContactPayload } from '../services/miscApi';

/** POST /api/contact — submit the public contact form. */
export const useSubmitContact = () => {
  return useMutation({
    mutationFn: (payload: ContactPayload) => contactApi.send(payload),
  });
};
