'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { WebSocketManager } from '@/lib/websocket';

interface FileTransferProps {
  deviceId: string;
  wsManager: WebSocketManager;
  isConnected: boolean;
}

interface TransferFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
}

export default function FileTransfer({ deviceId, wsManager, isConnected }: FileTransferProps) {
  const [transferFiles, setTransferFiles] = useState<TransferFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const addFile = useCallback((file: File) => {
    const transferFile: TransferFile = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'pending'
    };

    setTransferFiles(prev => [...prev, transferFile]);
    return transferFile;
  }, []);

  const updateFileProgress = useCallback((fileId: string, progress: number, status?: TransferFile['status']) => {
    setTransferFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, progress, ...(status && { status }) }
        : file
    ));
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    const transferFile = addFile(file);
    
    if (!isConnected) {
      updateFileProgress(transferFile.id, 0, 'failed');
      return;
    }

    updateFileProgress(transferFile.id, 0, 'uploading');

    try {
      // Send file via WebSocket in chunks
      wsManager.sendFile(deviceId, file, (progress) => {
        updateFileProgress(transferFile.id, progress, 'uploading');
      });

      // Listen for completion
      wsManager.onFileTransferComplete((deviceIdResponse, fileName, success) => {
        if (deviceIdResponse === deviceId && fileName === file.name) {
          updateFileProgress(transferFile.id, 100, success ? 'completed' : 'failed');
        }
      });

    } catch (error) {
      console.error('File upload error:', error);
      updateFileProgress(transferFile.id, 0, 'failed');
    }
  }, [deviceId, wsManager, isConnected, addFile, updateFileProgress]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(uploadFile);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadFile]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(uploadFile);
    }
  }, [uploadFile]);

  const removeFile = useCallback((fileId: string) => {
    setTransferFiles(prev => prev.filter(file => file.id !== fileId));
  }, []);

  const clearCompleted = useCallback(() => {
    setTransferFiles(prev => prev.filter(file => file.status !== 'completed'));
  }, []);

  const retryFile = useCallback((fileId: string) => {
    const file = transferFiles.find(f => f.id === fileId);
    if (file) {
      // Create a new File object (this is a simplified approach)
      // In a real implementation, you'd need to store the original File object
      updateFileProgress(fileId, 0, 'pending');
    }
  }, [transferFiles, updateFileProgress]);

  const getStatusBadge = (status: TransferFile['status'], progress: number) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'uploading':
        return <Badge className="bg-blue-500 text-white">Uploading {Math.round(progress)}%</Badge>;
      case 'completed':
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const totalFiles = transferFiles.length;
  const completedFiles = transferFiles.filter(f => f.status === 'completed').length;
  const failedFiles = transferFiles.filter(f => f.status === 'failed').length;
  const activeUploads = transferFiles.filter(f => f.status === 'uploading').length;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">File Transfer</CardTitle>
        {totalFiles > 0 && (
          <div className="text-sm text-gray-600">
            {completedFiles}/{totalFiles} completed
            {failedFiles > 0 && `, ${failedFiles} failed`}
            {activeUploads > 0 && `, ${activeUploads} uploading`}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver
              ? 'border-blue-500 bg-blue-50'
              : isConnected
              ? 'border-gray-300 hover:border-gray-400'
              : 'border-gray-200 bg-gray-50'
          } ${!isConnected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => isConnected && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={!isConnected}
          />
          
          {isConnected ? (
            <>
              <div className="text-4xl mb-2">📁</div>
              <p className="text-sm text-gray-600 mb-1">
                Drop files here or click to select
              </p>
              <p className="text-xs text-gray-500">
                Supports all file types
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-2 opacity-50">📁</div>
              <p className="text-sm text-gray-500">
                Connect to device to transfer files
              </p>
            </>
          )}
        </div>

        {/* File List */}
        {transferFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Transfer Queue</h3>
              {completedFiles > 0 && (
                <Button
                  onClick={clearCompleted}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Clear Completed
                </Button>
              )}
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {transferFiles.map((file) => (
                <div
                  key={file.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(file.status, file.progress)}
                      <Button
                        onClick={() => {
                          if (file.status === 'failed') {
                            retryFile(file.id);
                          } else {
                            removeFile(file.id);
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-xs px-2 py-1"
                      >
                        {file.status === 'failed' ? 'Retry' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                  
                  {file.status === 'uploading' && (
                    <Progress value={file.progress} className="h-2" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              📷 Photos
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              🎵 Music
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              📄 Documents
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              🎬 Videos
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}