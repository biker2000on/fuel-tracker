import { Suspense } from 'react'
import { isOidcConfigured, getOidcProviderName } from '@/lib/oidc'
import { LoginForm } from './login-form'

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
