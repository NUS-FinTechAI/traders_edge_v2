import useAuth from './useAuth.ts'

export default function useUser() {
  return useAuth().user
}
