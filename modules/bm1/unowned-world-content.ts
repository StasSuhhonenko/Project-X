/** Source presentation facts for unowned planets. Null ownership is shared
 * content semantics; the original "None" label and map spelling stay in BM1. */
import {z} from 'zod';
import data from './unowned-world-data.json';

export const UnownedWorldContentSchema=z.object({
  sourceSha256:z.string().regex(/^[a-f0-9]{64}$/),
  governmentLabel:z.literal('None'),
  systems:z.array(z.object({
    systemId:z.number().int().positive(),mapLabel:z.string().min(1),
  }).strict().readonly()).length(5).readonly(),
}).strict().superRefine((value,context)=>{
  if(value.systems.map(row=>row.systemId).join(',')!=='10,17,24,26,32')
    context.addIssue({code:'custom',message:'Unowned ordinary source scope differs.'});
}).readonly();
export const unownedWorldContent=UnownedWorldContentSchema.parse(data);

/** Map labels and planet names come from distinct original tables. */
export function sourceMapLabel(systemId:number,planetName:string):string {
  return unownedWorldContent.systems.find(row=>row.systemId===systemId)?.mapLabel??planetName;
}
