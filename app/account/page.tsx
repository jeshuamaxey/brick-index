import { redirect } from 'next/navigation';
import { getServerSession, getUserGroups, getUserPermissions } from '@/lib/auth/auth-helpers';
import { Card } from '@/components/ui/card';

export default async function AccountPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth/signin?redirect=/account');
  }

  const { user } = session;
  const groups = await getUserGroups(user.id);
  const permissions = await getUserPermissions(user.id);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Account</h1>

      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Email:</span>{' '}
              <span className="text-muted-foreground">{user.email}</span>
            </div>
            <div>
              <span className="font-medium">User ID:</span>{' '}
              <span className="text-muted-foreground font-mono text-sm">{user.id}</span>
            </div>
            {user.created_at && (
              <div>
                <span className="font-medium">Account Created:</span>{' '}
                <span className="text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </Card>

        {groups.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Groups</h2>
            <div className="space-y-2">
              {groups.map((group: { group_id: string; group_name: string; role_name: string }) => (
                <div key={group.group_id} className="flex items-center justify-between">
                  <span className="font-medium">{group.group_name}</span>
                  <span className="text-sm text-muted-foreground">Role: {group.role_name}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {permissions.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Permissions</h2>
            <div className="flex flex-wrap gap-2">
              {permissions.map((permission: string) => (
                <span
                  key={permission}
                  className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                >
                  {permission}
                </span>
              ))}
            </div>
          </Card>
        )}

        {groups.length === 0 && (
          <Card className="p-6">
            <p className="text-muted-foreground">
              You are not currently assigned to any groups. Contact an administrator to get access.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
