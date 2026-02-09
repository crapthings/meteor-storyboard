import { useState } from "react";
import { useNavigate } from "react-router";
import { Meteor } from "meteor/meteor";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { Button } from "@heroui/react";
import { StoryboardsCollection } from "../../api/storyboards.js";

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
    <div className="flex w-full flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-slate-50 px-6 py-8 shadow-sm sm:px-10 sm:py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
              Storyboards
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              Plan shots, align assets, ship faster.
            </h1>
            <p className="mt-3 text-base text-slate-600 sm:text-lg">
              Build visual sequences for each deliverable and control the render
              order with drag-and-drop columns.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onPress={handleCreateStoryboard}
              isDisabled={isCreating}
              className="rounded-full px-6 py-2 text-sm font-semibold"
              color="success"
            >
              {isCreating ? "Creating..." : "New Storyboard"}
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-emerald-100/70 blur-2xl" />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Your storyboards
            </h2>
            <p className="text-sm text-slate-500">
              {isStoryboardsLoading()
                ? "Loading..."
                : `${storyboards.length} total`}
            </p>
          </div>
        </div>
        {isStoryboardsLoading() ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
            Loading storyboards...
          </div>
        ) : storyboards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
            No storyboards yet. Create your first one to get started.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {storyboards.map((storyboard) => (
              <li
                key={storyboard._id}
                className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  <div className="text-base font-semibold text-slate-900">
                    {storyboard.name}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {storyboard.description ||
                      "Add a short description for this storyboard."}
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button
                    variant="bordered"
                    onPress={() => navigate(`/storyboard/${storyboard._id}`)}
                    className="rounded-full"
                  >
                    Open
                  </Button>
                  <Button
                    color="danger"
                    variant="flat"
                    onPress={() => handleDeleteStoryboard(storyboard._id)}
                    isDisabled={deletingId === storyboard._id}
                    className="rounded-full"
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
  );
};
