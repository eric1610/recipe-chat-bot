import type {
	ConversationImport,
	StoredConversation,
	StoredMessage
} from '$lib/chat/types';
import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';

const databaseName = 'recipe-chat-bot';
const databaseVersion = 1;

interface GuestChatDatabase extends DBSchema {
	conversations: {
		key: string;
		value: StoredConversation;
		indexes: { 'by-updated-at': string };
	};
	messages: {
		key: string;
		value: StoredMessage;
		indexes: { 'by-conversation': string };
	};
}

let databasePromise: Promise<IDBPDatabase<GuestChatDatabase>> | undefined;

function getDatabase() {
	if (typeof indexedDB === 'undefined') throw new Error('Guest history is only available in the browser.');

	databasePromise ??= openDB<GuestChatDatabase>(databaseName, databaseVersion, {
		upgrade(database) {
			const conversations = database.createObjectStore('conversations', { keyPath: 'id' });
			conversations.createIndex('by-updated-at', 'updatedAt');

			const messages = database.createObjectStore('messages', { keyPath: 'id' });
			messages.createIndex('by-conversation', 'conversationId');
		}
	});

	return databasePromise;
}

export async function listGuestConversations(): Promise<StoredConversation[]> {
	const database = await getDatabase();
	const records = await database.getAllFromIndex('conversations', 'by-updated-at');
	return records.reverse();
}

export async function countGuestConversations(): Promise<number> {
	return (await getDatabase()).count('conversations');
}

export async function saveGuestConversation(
	conversation: StoredConversation,
	messages: StoredMessage[] = []
): Promise<void> {
	const database = await getDatabase();
	const transaction = database.transaction(['conversations', 'messages'], 'readwrite');
	await transaction.objectStore('conversations').put(conversation);
	for (const message of messages) await transaction.objectStore('messages').put(message);
	await transaction.done;
}

export async function deleteGuestConversation(conversationId: string): Promise<void> {
	const database = await getDatabase();
	const transaction = database.transaction(['conversations', 'messages'], 'readwrite');
	const messageIds = await transaction.objectStore('messages').index('by-conversation').getAllKeys(conversationId);
	for (const messageId of messageIds) await transaction.objectStore('messages').delete(messageId);
	await transaction.objectStore('conversations').delete(conversationId);
	await transaction.done;
}

export async function readGuestImport(): Promise<ConversationImport> {
	const database = await getDatabase();
	const transaction = database.transaction(['conversations', 'messages'], 'readonly');
	const [conversations, messages] = await Promise.all([
		transaction.objectStore('conversations').getAll(),
		transaction.objectStore('messages').getAll()
	]);
	await transaction.done;
	return { conversations, messages };
}

export async function clearGuestHistory(): Promise<void> {
	const database = await getDatabase();
	const transaction = database.transaction(['conversations', 'messages'], 'readwrite');
	await Promise.all([
		transaction.objectStore('conversations').clear(),
		transaction.objectStore('messages').clear()
	]);
	await transaction.done;
}

export async function resetGuestDatabaseForTests(): Promise<void> {
	if (databasePromise) (await databasePromise).close();
	databasePromise = undefined;
	await deleteDB(databaseName);
}
