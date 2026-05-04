import { useState, useEffect, useCallback } from 'react';
import { getJobStatus } from '../api';

export const useTestJobStatus = (jobId, initialInterval = 2000) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;

    setLoading(true);
    setError(null);
    try {
      const result = await getJobStatus(jobId);
      setStatus(result);

      // 如果测试还在运行，继续轮询
      if (result.status === 'running' || result.status === 'pending') {
        setTimeout(() => {
          fetchStatus();
        }, initialInterval);
      }
    } catch (err) {
      setError(err.message);
      // 即使出错，也继续尝试获取状态，直到测试完成
      if (status?.status === 'running' || status?.status === 'pending') {
        setTimeout(() => {
          fetchStatus();
        }, initialInterval);
      }
    } finally {
      setLoading(false);
    }
  }, [jobId, initialInterval, status?.status]);

  useEffect(() => {
    if (jobId) {
      fetchStatus();
    }
  }, [jobId]);

  const refetch = useCallback(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    refetch,
    isRunning: status?.status === 'running' || status?.status === 'pending',
    isCompleted: status?.status === 'completed' || status?.status === 'failed'
  };
};