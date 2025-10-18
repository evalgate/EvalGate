import { db } from '@/db';
import { apiKeys, user } from '@/db/schema';
import crypto from 'crypto';

async function main() {
    // Query existing users first
    const users = await db.select().from(user);
    
    if (users.length === 0) {
        console.error('❌ No users found in database. Please seed users first.');
        return;
    }

    const now = new Date();
    const getDateDaysAgo = (days: number) => {
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date.toISOString();
    };

    const getDateDaysFromNow = (days: number) => {
        const date = new Date(now);
        date.setDate(date.getDate() + days);
        return date.toISOString();
    };

    const sampleApiKeys = [
        {
            userId: users[0].id,
            organizationId: 1,
            keyHash: crypto.createHash('sha256').update('test_key_1').digest('hex'),
            keyPrefix: 'sk_prod_',
            name: 'Production Key',
            scopes: JSON.stringify(['traces:read', 'traces:write', 'evaluations:read', 'evaluations:write']),
            lastUsedAt: getDateDaysAgo(2),
            expiresAt: null,
            revokedAt: null,
            createdAt: getDateDaysAgo(25),
        },
        {
            userId: users[0].id,
            organizationId: 1,
            keyHash: crypto.createHash('sha256').update('test_key_2').digest('hex'),
            keyPrefix: 'sk_dev_',
            name: 'Development Key',
            scopes: JSON.stringify(['traces:read', 'traces:write']),
            lastUsedAt: getDateDaysAgo(5),
            expiresAt: null,
            revokedAt: null,
            createdAt: getDateDaysAgo(20),
        },
        {
            userId: users[0].id,
            organizationId: 1,
            keyHash: crypto.createHash('sha256').update('test_key_3').digest('hex'),
            keyPrefix: 'sk_cicd_',
            name: 'CI/CD Pipeline',
            scopes: JSON.stringify(['evaluations:read', 'evaluations:write', 'traces:read']),
            lastUsedAt: getDateDaysAgo(3),
            expiresAt: getDateDaysFromNow(90),
            revokedAt: null,
            createdAt: getDateDaysAgo(15),
        },
    ];

    // If there's a second user, add keys for them with organizationId 2
    if (users.length > 1) {
        sampleApiKeys.push(
            {
                userId: users[1].id,
                organizationId: 2,
                keyHash: crypto.createHash('sha256').update('test_key_4').digest('hex'),
                keyPrefix: 'sk_stag_',
                name: 'Staging Environment',
                scopes: JSON.stringify(['traces:read', 'traces:write', 'evaluations:read']),
                lastUsedAt: getDateDaysAgo(4),
                expiresAt: '',
                revokedAt: null,
                createdAt: getDateDaysAgo(30),
            },
            {
                userId: users[1].id,
                organizationId: 2,
                keyHash: crypto.createHash('sha256').update('test_key_5').digest('hex'),
                keyPrefix: 'sk_test_',
                name: 'Testing Key',
                scopes: JSON.stringify(['traces:read']),
                lastUsedAt: '',
                expiresAt: '',
                revokedAt: null,
                createdAt: getDateDaysAgo(18),
            },
            {
                userId: users[1].id,
                organizationId: 2,
                keyHash: crypto.createHash('sha256').update('test_key_6').digest('hex'),
                keyPrefix: 'sk_back_',
                name: 'Backup Key',
                scopes: JSON.stringify(['traces:read', 'traces:write', 'evaluations:read', 'evaluations:write']),
                lastUsedAt: '',
                expiresAt: '',
                revokedAt: null,
                createdAt: getDateDaysAgo(10),
            }
        );
    }

    await db.insert(apiKeys).values(sampleApiKeys);
    
    console.log('✅ API Keys seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});