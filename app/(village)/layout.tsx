/** The village: the world (children) and the @sheet slot, where places open as parchment sheets (§8). */
export default function VillageLayout({
  children,
  sheet,
}: {
  children: React.ReactNode;
  sheet: React.ReactNode;
}) {
  return (
    <>
      {children}
      {sheet}
    </>
  );
}
