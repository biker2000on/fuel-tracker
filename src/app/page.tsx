import AuthStatus from '@/components/AuthStatus'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 dark:from-gray-900 dark:to-gray-800">
      <main className="flex flex-col items-center">
        <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400 sm:text-5xl">
          Fuel Tracker
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
          Track fuel consumption across your vehicles
        </p>
        <AuthStatus />
      </main>
    </div>
  );
}
