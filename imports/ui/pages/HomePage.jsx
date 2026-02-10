import { useState } from "react";
import { useNavigate } from "react-router";
import { Meteor } from "meteor/meteor";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { Button } from "@heroui/react";
import { StoryboardsCollection } from "../../api/storyboards.js";

const formatDateLabel = (value) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString();
};

const getStoryboardDescription = (storyboard) =>
  storyboard?.description || "Add a short description for this storyboard.";

export const HomePage = () => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const isStoryboardsLoading = useSubscribe("storyboards");
  const storyboards = useFind(() =>
    StoryboardsCollection.find({}, { sort: { order: 1, createdAt: -1 } })
  );

  const handleCreateStoryboard = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const storyboardId = await Meteor.callAsync("storyboards.create", {
        name: "New Storyboard",
      });
      if (storyboardId) {
        navigate(`/storyboard/${storyboardId}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteStoryboard = async (storyboardId) => {
    if (!storyboardId || deletingId) return;
    setDeletingId(storyboardId);
    try {
      await Meteor.callAsync("storyboards.remove", { storyboardId });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-full w-full bg-neutral-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="bg-neutral-900 p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-300">
                Storyboards
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl">
                Organize sequences before rendering.
              </h1>
              <p className="mt-3 text-sm text-neutral-300 sm:text-base">
                Create boards, open shots, and keep your visual production flow
                in one neutral workspace.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="tertiary"
                onPress={handleCreateStoryboard}
                isDisabled={isCreating}
                className="rounded-full bg-neutral-50 px-6 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-300"
              >
                {isCreating ? "Creating..." : "New Storyboard"}
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:max-w-md">
            <div className="bg-neutral-600 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-200">
                Total
              </p>
              <p className="mt-1 text-2xl font-semibold text-neutral-50">
                {isStoryboardsLoading() ? "..." : storyboards.length}
              </p>
            </div>
            <div className="bg-neutral-600 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-200">
                Status
              </p>
              <p className="mt-1 text-sm font-medium text-neutral-50">
                {isStoryboardsLoading() ? "Syncing" : "Ready"}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-neutral-300 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-neutral-900">
              Your storyboards
            </h2>
            <p className="text-sm text-neutral-700">
              {isStoryboardsLoading()
                ? "Loading..."
                : `${storyboards.length} total`}
            </p>
          </div>
          {isStoryboardsLoading() ? (
            <div className="bg-neutral-50 px-6 py-10 text-sm text-neutral-700">
              Loading storyboards...
            </div>
          ) : storyboards.length === 0 ? (
            <div className="bg-neutral-50 px-6 py-10 text-sm text-neutral-700">
              No storyboards yet. Create your first one to get started.
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {storyboards.map((storyboard) => (
                <li
                  key={storyboard._id}
                  className="flex h-full flex-col justify-between bg-neutral-50 p-5 transition"
                >
                  <div>
                    <div className="text-base font-semibold text-neutral-900">
                      {storyboard.name}
                    </div>
                    <p className="mt-2 text-sm text-neutral-700">
                      {getStoryboardDescription(storyboard)}
                    </p>
                    <p className="mt-4 text-xs uppercase tracking-[0.14em] text-neutral-600">
                      Updated {formatDateLabel(storyboard.updatedAt || storyboard.createdAt)}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      variant="tertiary"
                      onPress={() => navigate(`/storyboard/${storyboard._id}`)}
                      className="rounded-full bg-neutral-600 text-neutral-50"
                    >
                      Open
                    </Button>
                    <Button
                      variant="tertiary"
                      onPress={() => handleDeleteStoryboard(storyboard._id)}
                      isDisabled={deletingId === storyboard._id}
                      className="rounded-full bg-neutral-600 text-neutral-50"
                    >
                      {deletingId === storyboard._id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
