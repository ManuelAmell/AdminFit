export type PickedMember = {
  id: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  status: string;
};

export function memberLabel(m: Pick<PickedMember, "firstName" | "lastName">) {
  return `${m.firstName} ${m.lastName}`;
}
