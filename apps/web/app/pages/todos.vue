<script setup lang="ts">
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import { useConvexMutation, useConvexQuery } from "convex-vue";
import { ref } from "vue";

const { data, error, isPending } = useConvexQuery(api.todos.getAll, {});

const newTodoText = ref("");
const { mutate: createTodo, isPending: isCreatePending } = useConvexMutation(api.todos.create);

const { mutate: toggleTodo } = useConvexMutation(api.todos.toggle);
const { mutate: deleteTodo, error: deleteError } = useConvexMutation(api.todos.deleteTodo);

function handleAddTodo() {
  const text = newTodoText.value.trim();
  if (!text) return;

  createTodo({ text });
  newTodoText.value = "";
}

function handleToggleTodo(id: Id<"todos">, completed: boolean) {
  toggleTodo({ id, completed: !completed });
}

function handleDeleteTodo(id: Id<"todos">) {
  deleteTodo({ id });
}
</script>

<template>
  <UContainer class="py-8 max-w-md">
    <UCard>
      <template #header>
        <div>
          <div class="text-xl font-bold">Todo List</div>
          <div class="text-muted text-sm">Manage your tasks efficiently</div>
        </div>
      </template>

      <form @submit.prevent="handleAddTodo" class="mb-6 flex items-center gap-2">
        <UInput
          v-model="newTodoText"
          placeholder="Add a new task..."
          autocomplete="off"
          class="flex-1"
          :disabled="isCreatePending"
        />
        <UButton type="submit" :loading="isCreatePending" :disabled="!newTodoText.trim()">
          Add
        </UButton>
      </form>

      <!-- Loading State -->
      <div v-if="isPending" class="space-y-2">
        <USkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <!-- Error State -->
      <UAlert
        v-else-if="error || deleteError"
        color="error"
        icon="i-lucide-alert-circle"
        title="Error"
        :description="error?.message || deleteError?.message"
      />

      <!-- Empty State -->
      <UEmpty
        v-else-if="data?.length === 0"
        icon="i-lucide-clipboard-list"
        title="No todos yet"
        description="Add your first task above!"
      />

      <!-- Todo List -->
      <ul v-else-if="data" class="space-y-2">
        <li
          v-for="todo in data"
          :key="todo._id"
          class="flex items-center justify-between rounded-md border p-3"
        >
          <div class="flex items-center gap-3">
            <UCheckbox
              :model-value="todo.completed"
              @update:model-value="() => handleToggleTodo(todo._id, todo.completed)"
              :id="`todo-${todo._id}`"
            />
            <label
              :for="`todo-${todo._id}`"
              :class="{ 'line-through text-muted': todo.completed }"
              class="cursor-pointer"
            >
              {{ todo.text }}
            </label>
          </div>
          <UButton
            color="error"
            variant="ghost"
            size="sm"
            square
            @click="handleDeleteTodo(todo._id)"
            aria-label="Delete todo"
            icon="i-lucide-trash-2"
          />
        </li>
      </ul>
    </UCard>
  </UContainer>
</template>
