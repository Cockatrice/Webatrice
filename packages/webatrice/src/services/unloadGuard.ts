const risks = new Set<object>();

export function setUnloadRisk(key: object, active: boolean): void {
  if (active) {
    risks.add(key);
  } else {
    risks.delete(key);
  }
}

export function hasUnloadRisk(): boolean {
  return risks.size > 0;
}

export function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (!hasUnloadRisk()) {
    return;
  }
  event.preventDefault();
  event.returnValue = '';
}
