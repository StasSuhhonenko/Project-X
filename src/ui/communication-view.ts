/** A copied semantic outcome, never a writable world or store capability. */
import { z } from 'zod';
import { PlayerCommunicationSchema } from '../simulation/model/entity-components';

/** The authoritative feedback schema owns code/text/revision constraints. */
export const CommunicationViewSchema = PlayerCommunicationSchema;
export type CommunicationView = z.infer<typeof CommunicationViewSchema>;
