/** The optional `avatar_image` art key on a player profile. */
export function playerAvatarImage(player: object): string | null {
  const value = (player as { avatar_image?: unknown }).avatar_image
  return typeof value === 'string' ? value : null
}

/** The optional `image` art key on a reward, shop or collection item. */
export function itemImage(item: object): string | null {
  const value = (item as { image?: unknown }).image
  return typeof value === 'string' ? value : null
}
