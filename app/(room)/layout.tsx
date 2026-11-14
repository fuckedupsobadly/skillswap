/** Lantern Rooms (§8.5): the calm session layout. No walking, no kitty roaming, no game notices. */
export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <main id="main">{children}</main>;
}
