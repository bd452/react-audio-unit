#pragma once

#include <atomic>
#include <array>
#include <cstddef>
#include <type_traits>

namespace rau
{

    /**
     * SPSCQueue — single-producer single-consumer lock-free FIFO.
     *
     * Real-time safe on the consumer side (no syscalls, no allocation).
     * Uses a fixed-size ring buffer with atomic head/tail indices.
     *
     * Producer: message thread (queueOp)
     * Consumer: audio thread (applyPendingOps)
     *
     * @tparam T    - Element type (must be move-constructible)
     * @tparam Size - Maximum number of elements (must be power of 2)
     */
    template <typename T, size_t Size>
    class SPSCQueue
    {
        static_assert((Size & (Size - 1)) == 0, "Size must be a power of 2");

    public:
        SPSCQueue() : head(0), tail(0) {}

        /**
         * Push an element (producer side — message thread).
         * Returns false if the queue is full.
         */
        bool push(T &&item)
        {
            const size_t currentTail = tail.load(std::memory_order_relaxed);
            const size_t nextTail = (currentTail + 1) & MASK;

            if (nextTail == head.load(std::memory_order_acquire))
            {
                return false; // Queue full
            }

            buffer[currentTail] = std::move(item);
            tail.store(nextTail, std::memory_order_release);
            return true;
        }

        /**
         * Pop an element (consumer side — audio thread).
         * Returns false if the queue is empty.
         */
        bool pop(T &item)
        {
            const size_t currentHead = head.load(std::memory_order_relaxed);

            if (currentHead == tail.load(std::memory_order_acquire))
            {
                return false; // Queue empty
            }

            item = std::move(buffer[currentHead]);
            head.store((currentHead + 1) & MASK, std::memory_order_release);
            return true;
        }

        /**
         * Check if the queue is empty (approximate — may race).
         */
        bool empty() const
        {
            return head.load(std::memory_order_relaxed) ==
                   tail.load(std::memory_order_relaxed);
        }

        /**
         * Approximate number of items in the queue.
         */
        size_t sizeApprox() const
        {
            const size_t h = head.load(std::memory_order_relaxed);
            const size_t t = tail.load(std::memory_order_relaxed);
            return (t - h) & MASK;
        }

    private:
        static constexpr size_t MASK = Size - 1;

        // Separate cache lines to avoid false sharing
        alignas(64) std::atomic<size_t> head;
        alignas(64) std::atomic<size_t> tail;
        std::array<T, Size> buffer;
    };

} // namespace rau
