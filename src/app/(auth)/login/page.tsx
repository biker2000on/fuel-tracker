import { Suspense } from 'react'
import { isOidcConfigured, getOidcProviderName } from '@/lib/oidc'
import { LoginForm } from './login-form'

// OIDC availability is read from env at request time, not baked in at build
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm
        oidcEnabled={isOidcConfigured()}
        oidcProviderName={getOidcProviderName()}
      />
    </Suspense>
  )
}
