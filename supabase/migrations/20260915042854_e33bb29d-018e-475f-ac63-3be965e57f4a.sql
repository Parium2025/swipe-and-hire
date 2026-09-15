-- Kollegor i samma organisation ska kunna se och boka om/avboka varandras
-- intervjuer för delade kandidater — annars får kandidaten dubbla kallelser.
CREATE POLICY "Organization members can view colleague interviews"
ON public.interviews
FOR SELECT
TO authenticated
USING (public.same_organization((SELECT auth.uid()), employer_id));

CREATE POLICY "Organization members can update colleague interviews"
ON public.interviews
FOR UPDATE
TO authenticated
USING (public.same_organization((SELECT auth.uid()), employer_id))
WITH CHECK (public.same_organization((SELECT auth.uid()), employer_id));