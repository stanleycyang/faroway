import { catalog } from './catalog';

export interface ValidatedPreviewBlock {
  type: keyof typeof catalog;
  props: Record<string, unknown>;
}

/** AI and transport data stay untrusted until the component schema accepts them. */
export function validatePreviewBlocks(input: readonly unknown[]) {
  const blocks: ValidatedPreviewBlock[] = [];
  let rejected = 0;
  for (const value of input) {
    if (
      !value ||
      typeof value !== 'object' ||
      !('type' in value) ||
      typeof value.type !== 'string' ||
      !Object.hasOwn(catalog, value.type)
    ) {
      rejected++;
      continue;
    }
    const type = value.type as keyof typeof catalog;
    const result = catalog[type].schema.safeParse('props' in value ? value.props : undefined);
    if (!result.success) {
      rejected++;
      continue;
    }
    blocks.push({ type, props: result.data });
  }
  return { blocks, rejected };
}
