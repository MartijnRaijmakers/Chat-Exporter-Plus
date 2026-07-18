import { DEFAULT_WHITESPACE_MODE } from "./constants.js";

export function getMessagesToExport() {
  if (game.messages?.contents) {
    return [...game.messages.contents];
  }

  if (ui.chat?.messages?.contents) {
    return [...ui.chat.messages.contents];
  }

  return Array.from(game.messages ?? []);
}

export function buildExportMetadata(messages) {
  const timestamps = messages.map(getMessageTimestamp).filter((timestamp) => timestamp != null);
  const earliest = timestamps.length ? new Date(Math.min(...timestamps)) : null;
  const latest = timestamps.length ? new Date(Math.max(...timestamps)) : null;

  return {
    messageCount: messages.length,
    earliest,
    earliestLabel: formatExportDateLabel(earliest),
    latest,
    latestLabel: formatExportDateLabel(latest)
  };
}

export function getMessageTimestamp(message) {
  if (!message) {
    return null;
  }

  const timestamp = message.timestamp ?? message.createdAt ?? message.date;
  if (timestamp == null) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function formatExportDateLabel(value) {
  if (!value) {
    return "Not available";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString();
}

export function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function sanitizeText(value, whitespaceMode = DEFAULT_WHITESPACE_MODE) {
  if (value == null) {
    return "";
  }

  if (whitespaceMode === "preserve") {
    return value;
  }

  return value.replace(/>\s+|\s+</g, function (m) {
    return m.trim();
  });
}

export function buildExportPayload(messages, whitespaceMode = DEFAULT_WHITESPACE_MODE) {
  const sanitizedMessages = messages.map((message) => ({
    ...message.toJSON(),
    content: sanitizeText(message.content ?? "", whitespaceMode),
    rolls: JSON.parse(JSON.stringify(message.rolls ?? [])),
  }));

  const payload = {
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: sanitizedMessages
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });

  return {
    payload,
    jsonContent,
    blob
  };
}

export function estimateExportSize(messages, whitespaceMode = DEFAULT_WHITESPACE_MODE) {
  const { blob } = buildExportPayload(messages, whitespaceMode);
  return blob.size;
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
